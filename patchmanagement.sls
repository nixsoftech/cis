include:
  - repo_config

update_pkg_db:
  pkg.update

non_interactive_upgrade:
  pkg.upgrade:
    - name: '*'
    - env:
      - DEBIAN_FRONTEND: noninteractive
      - UCF_FORCE_CONFFOLD: 1  # Add this for config file handling
    - extra_args: "-o Dpkg::Options::='--force-confdef' -o Dpkg::Options::='--force-confold'"
    - cache_valid_time: 3600
    - require:
      - pkg: update_pkg_db
