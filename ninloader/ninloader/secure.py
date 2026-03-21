"""SecureString wrapper — prevents accidental token leakage in logs/repr."""


class SecureString(str):
    """A string subclass that redacts its value in repr() and str().

    Use .value to access the actual plaintext. This prevents accidental
    leakage of tokens in debug output, logs, exception tracebacks, etc.
    """

    def __repr__(self) -> str:
        return "<REDACTED>"

    def __str__(self) -> str:
        return "<REDACTED>"

    @property
    def value(self) -> str:
        """Return the actual plaintext value."""
        return super().__str__()

    def __format__(self, format_spec: str) -> str:
        return "<REDACTED>"


def secure(value: str) -> SecureString:
    """Wrap a plaintext string as a SecureString."""
    if value is None:
        return None
    return SecureString(value)
