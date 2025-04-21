# Install update-manager-core
install_update_manager:
  pkg.installed:
    - name: update-manager-core

# Configure release-upgrades to allow non-interactive upgrades
configure_release_upgrades:
  file.managed:
    - name: /etc/update-manager/release-upgrades
    - contents: |
        [DEFAULT]
        Prompt=normal
    - require:
      - pkg: install_update_manager

# Step 1: Configure repository for current codename and upgrade to 20.04
{% set codename = grains['lsb_distrib_codename'] %}
configure_repo_initial:
  pkgrepo.managed:
    - humanname: Custom Ubuntu Repository
    - name: deb [arch=amd64] http://10.13.0.88:8080/ubuntu {{ codename }} main
    - file: /etc/apt/sources.list.d/custom-ubuntu.list
    - key_url: http://10.13.0.88:8080/ubuntu/key.asc
    - refresh: True
    - clean_file: True
    - onlyif: lsb_release -cs | grep -q bionic

update_package_cache_initial:
  pkg.uptodate:
    - refresh: True
    - require:
      - pkgrepo: configure_repo_initial

upgrade_to_2004:
  cmd.run:
    - name: DEBIAN_FRONTEND=noninteractive do-release-upgrade -f DistUpgradeViewNonInteractive
    - unless: lsb_release -cs | grep -q focal
    - require:
      - file: configure_release_upgrades
      - pkg: update_package_cache_initial

# Wait for reboot after 20.04 upgrade
wait_for_reboot_2004:
  cmd.run:
    - name: |
        for i in {1..60}; do
          if ping -c 1 {{ pillar['target_ip'] }} >/dev/null; then
            sleep 10
            salt '{{ grains['id'] }}' test.ping && break
          fi
          sleep 30
        done
    - require:
      - cmd: upgrade_to_2004
    - onlyif: lsb_release -cs | grep -q focal

# Step 2: Configure repository for 20.04 and upgrade to 22.04
configure_repo_focal:
  pkgrepo.managed:
    - humanname: Custom Ubuntu Repository
    - name: deb [arch=amd64] http://10.13.0.88:8080/ubuntu focal main
    - file: /etc/apt/sources.list.d/custom-ubuntu.list
    - key_url: http://10.13.0.88:8080/ubuntu/key.asc
    - refresh: True
    - clean_file: True
    - require:
      - cmd: wait_for_reboot_2004
    - onlyif: lsb_release -cs | grep -q focal

update_package_cache_focal:
  pkg.uptodate:
    - refresh: True
    - require:
      - pkgrepo: configure_repo_focal

upgrade_to_2204:
  cmd.run:
    - name: DEBIAN_FRONTEND=noninteractive do-release-upgrade -f DistUpgradeViewNonInteractive
    - unless: lsb_release -cs | grep -q jammy
    - require:
      - pkg: update_package_cache_focal

# Wait for reboot after 22.04 upgrade
wait_for_reboot_2204:
  cmd.run:
    - name: |
        for i in {1..60}; do
          if ping -c 1 {{ pillar['target_ip'] }} >/dev/null; then
            sleep 10
            salt '{{ grains['id'] }}' test.ping && break
          fi
          sleep 30
        done
    - require:
      - cmd: upgrade_to_2204
    - onlyif: lsb_release -cs | grep -q jamm
