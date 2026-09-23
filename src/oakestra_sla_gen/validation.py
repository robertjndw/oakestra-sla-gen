"""Validate an SLA dict against Oakestra's real schema, plus checks the schema doesn't cover.

This works on any SLA dict, not just ones this tool generated, so it also
doubles as a linter for hand-written SLAs (see the `validate` CLI subcommand).
"""

import re

import jsonschema

from .oakestra_schema import sla_schema

NAME_PATTERN = re.compile(r"^[a-zA-Z0-9]{1,10}$")
ENV_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*=.*$")
RR_IP_PATTERN = re.compile(r"^10\.30\.(\d{1,3})\.(\d{1,3})$")
PORT_MAPPING_PATTERN = re.compile(r"^(\d{1,5}):(\d{1,5})(/(tcp|udp))?$")


def _format_path(path) -> str:
    parts = []
    for element in path:
        if isinstance(element, int):
            parts[-1] = f"{parts[-1]}[{element}]"
        else:
            parts.append(str(element))
    return ".".join(parts) if parts else "<root>"


def _schema_errors(sla: dict) -> list[str]:
    validator = jsonschema.Draft7Validator(sla_schema)
    return [f"{_format_path(error.path)}: {error.message}" for error in validator.iter_errors(sla)]


def _check_name(value, path: str) -> list[str]:
    if not isinstance(value, str) or not NAME_PATTERN.match(value):
        return [f"{path}: name {value!r} must be 1-10 alphanumeric characters"]
    return []


def _check_port(port, path: str) -> list[str]:
    if port is None:
        return []
    if not isinstance(port, str) or not port:
        return [f"{path}: port must be a non-empty string"]
    errors = []
    for mapping in port.split(";"):
        match = PORT_MAPPING_PATTERN.match(mapping)
        if not match:
            errors.append(f"{path}: port mapping {mapping!r} is not host:container[/tcp|udp]")
            continue
        host_port, container_port = int(match.group(1)), int(match.group(2))
        if not (1 <= host_port <= 65535 and 1 <= container_port <= 65535):
            errors.append(f"{path}: port mapping {mapping!r} must use ports in 1-65535")
    return errors


def _check_rr_ip(microservice: dict, path: str) -> list[str]:
    addresses = microservice.get("addresses")
    if not isinstance(addresses, dict) or "rr_ip" not in addresses:
        return []
    rr_ip = addresses["rr_ip"]
    match = RR_IP_PATTERN.match(rr_ip) if isinstance(rr_ip, str) else None
    if not match or not all(0 <= int(octet) <= 255 for octet in match.groups()):
        return [f"{path}.addresses.rr_ip: {rr_ip!r} must be a service IP of the form 10.30.X.Y"]
    return []


def _check_microservice(microservice: dict, path: str) -> list[str]:
    errors = []
    errors += _check_name(microservice.get("microservice_name"), f"{path}.microservice_name")
    errors += _check_name(
        microservice.get("microservice_namespace"), f"{path}.microservice_namespace"
    )

    virtualization = microservice.get("virtualization")
    if virtualization not in ("container", "unikernel"):
        errors.append(
            f"{path}.virtualization: must be 'container' or 'unikernel', got {virtualization!r}"
        )

    if not microservice.get("code"):
        errors.append(f"{path}.code: must not be empty")

    errors += _check_port(microservice.get("port"), f"{path}.port")
    errors += _check_rr_ip(microservice, path)

    for i, entry in enumerate(microservice.get("environment") or []):
        if not isinstance(entry, str) or not ENV_PATTERN.match(entry):
            errors.append(f"{path}.environment[{i}]: {entry!r} must look like KEY=value")

    for resource in ("vcpus", "vgpus", "memory", "storage"):
        value = microservice.get(resource)
        if isinstance(value, (int, float)) and value < 0:
            errors.append(f"{path}.{resource}: must not be negative, got {value}")

    for i, constraint in enumerate(microservice.get("constraints") or []):
        has_target = constraint.get("node") or constraint.get("cluster")
        if constraint.get("type") == "direct" and not has_target:
            errors.append(f"{path}.constraints[{i}]: a direct constraint needs a node or a cluster")

    return errors


def _check_application(application: dict, path: str) -> list[str]:
    errors = []
    errors += _check_name(application.get("application_name"), f"{path}.application_name")
    errors += _check_name(application.get("application_namespace"), f"{path}.application_namespace")

    names = []
    for i, microservice in enumerate(application.get("microservices") or []):
        errors += _check_microservice(microservice, f"{path}.microservices[{i}]")
        names.append(microservice.get("microservice_name"))
    duplicates = {name for name in names if name and names.count(name) > 1}
    for name in duplicates:
        errors.append(f"{path}: microservice name {name!r} is used more than once")

    return errors


def _has_basic_shape(sla) -> bool:
    if not isinstance(sla, dict) or not isinstance(sla.get("applications", []), list):
        return False
    for application in sla.get("applications", []):
        if not isinstance(application, dict):
            return False
        microservices = application.get("microservices", [])
        if not isinstance(microservices, list):
            return False
        for microservice in microservices:
            if not isinstance(microservice, dict):
                return False
            if not isinstance(microservice.get("addresses", {}), dict):
                return False
            constraints = microservice.get("constraints", [])
            if not isinstance(constraints, list) or not all(
                isinstance(c, dict) for c in constraints
            ):
                return False
    return True


def validate_sla(sla: dict) -> list[str]:
    """Return every problem with `sla`. An empty list means it's a valid Oakestra SLA."""
    errors = _schema_errors(sla)
    # The semantic checks below assume the schema's basic shape; if a hand-written
    # file isn't even an object of objects, the schema errors already say why.
    if errors and not _has_basic_shape(sla):
        return errors

    if sla.get("sla_version") != "v2.0":
        errors.append(f"sla_version: must be 'v2.0', got {sla.get('sla_version')!r}")

    rr_ips: dict[str, str] = {}
    for i, application in enumerate(sla.get("applications") or []):
        errors += _check_application(application, f"applications[{i}]")
        for j, microservice in enumerate(application.get("microservices") or []):
            rr_ip = (microservice.get("addresses") or {}).get("rr_ip")
            path = f"applications[{i}].microservices[{j}].addresses.rr_ip"
            # A service IP load-balances across one service's instances, so two
            # services sharing one would receive each other's traffic.
            if not isinstance(rr_ip, str):
                continue
            if rr_ip in rr_ips:
                errors.append(f"{path}: {rr_ip!r} is already used by {rr_ips[rr_ip]}")
            else:
                rr_ips[rr_ip] = path

    return errors
