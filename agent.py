import subprocess
import requests
import configparser
import os
import psutil
import socket
from datetime import datetime
import pytz

def run_lynis():
    report_file = "/tmp/lynis-report.dat"
    try:
        subprocess.run(["sudo", "lynis", "audit", "system", "--no-colors", "--report-file", report_file], check=True)
        return report_file
    except subprocess.CalledProcessError as e:
        raise

def parse_report(report_file):
    scan_data = {
        "lynis_version": "unknown",
        "os": "unknown",
        "hostname": "unknown",
        "tests": [],
        "warnings": [],
        "suggestions": [],
        "hardening_index": 0
    }
    test_results = {}

    with open(report_file, "r") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, value = line.split("=", 1)
                if key == "lynis_version":
                    scan_data["lynis_version"] = value
                elif key == "os":
                    scan_data["os"] = value
                elif key == "hostname":
                    scan_data["hostname"] = value
                elif key == "hardening_index":
                    scan_data["hardening_index"] = int(value)
                elif key.startswith("warning[]"):
                    parts = value.split("|")
                    warning_text = parts[1] if len(parts) > 1 else value
                    scan_data["warnings"].append(warning_text)
                    if len(parts) > 0 and parts[0]:
                        test_id = parts[0]
                        test_results[test_id] = {"status": "WARNING", "description": warning_text}
                elif key.startswith("suggestion[]"):
                    parts = value.split("|")
                    suggestion_text = parts[1] if len(parts) > 1 else value
                    scan_data["suggestions"].append(suggestion_text)
                    if len(parts) > 0 and parts[0]:
                        test_id = parts[0]
                        test_results[test_id] = {"status": "SUGGESTION", "description": suggestion_text}

    with open(report_file, "r") as f:
        for line in f:
            line = line.strip()
            if line.startswith("tests_executed="):
                key, value = line.split("=", 1)
                test_ids = value.split("|")
                for test_id in test_ids:
                    if test_id and test_id not in test_results:
                        test_results[test_id] = {"status": "OK", "description": ""}

    for test_id, result in test_results.items():
        if test_id:
            scan_data["tests"].append({"test_id": test_id, "status": result["status"], "description": result["description"]})

    return scan_data

def collect_metrics():
    try:
        disk_usage = subprocess.check_output(["df", "-h", "/"]).decode().splitlines()[1].split()
        metrics = {
            "cpu_usage": psutil.cpu_percent(interval=1),
            "memory_usage": psutil.virtual_memory().percent,
            "disk_usage": {
                "filesystem": disk_usage[0],
                "size": disk_usage[1],
                "used": disk_usage[2],
                "avail": disk_usage[3],
                "use_percent": float(disk_usage[4].strip("%")),
                "mounted_on": disk_usage[5]
            }
        }
        return metrics
    except Exception as e:
        raise

def get_jwt_token(config):
    base_url = config['backend']['url'].rstrip('/')
    login_url = f"{base_url}/login"
    try:
        login_data = {
            "username": config["agent"]["username"],
            "password": config["agent"]["password"]
        }
        response = requests.post(login_url, json=login_data)
        response.raise_for_status()
        token = response.json().get("access_token")
        if not token:
            raise ValueError("No access_token in response")
        return token
    except requests.RequestException as e:
        raise
    except ValueError as e:
        raise

def send_data(scan_data, metrics, config, token):
    base_url = config['backend']['url'].rstrip('/')
    url = f"{base_url}/submit_scan"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    ist_tz = pytz.timezone("Asia/Kolkata")
    ist_timestamp = datetime.now(ist_tz).isoformat()
    data = {
        "server_id": scan_data["server_id"],
        "hostname": config["agent"]["hostname"],  # Enforce config value, no fallback
        "ip_address": config["agent"]["ip_address"],  # Enforce config value, no fallback
        "timestamp": ist_timestamp,
        "scan_data": scan_data,
        "metrics": metrics
    }
    print(f"Sending data: {data}")  # Debug payload

    try:
        response = requests.post(url, json=data, headers=headers)
        response.raise_for_status()
        print("Data sent successfully:", response.json())
    except requests.RequestException as e:
        print(f"Failed to send data: {response.status_code if 'response' in locals() else 'N/A'} - {e}")
        raise

def main():
    config = configparser.ConfigParser()
    config_file = "/opt/lynis-agent/agent.conf"
    if not os.path.exists(config_file):
        print(f"Error: Configuration file {config_file} not found")
        exit(1)
    config.read(config_file)

    required_keys = {"agent": ["server_id", "username", "password", "hostname", "ip_address"], "backend": ["url"]}
    for section, keys in required_keys.items():
        if section not in config:
            print(f"Error: Missing [{section}] section in {config_file}")
            exit(1)
        for key in keys:
            if key not in config[section]:
                print(f"Error: Missing '{key}' in [{section}] section of {config_file}")
                exit(1)

    try:
        report_file = run_lynis()
        scan_data = parse_report(report_file)
        scan_data["server_id"] = config["agent"]["server_id"]
        metrics = collect_metrics()
        token = get_jwt_token(config)
        send_data(scan_data, metrics, config, token)
    except Exception as e:
        print(f"Error: {str(e)}")
    finally:
        if 'report_file' in locals() and os.path.exists(report_file):
            os.remove(report_file)

if __name__ == "__main__":
    main()
