# Ensure package cache is updated
update_package_cache:
  pkg.uptodate:
    - refresh: True

# Upgrade all packages non-interactively
upgrade_packages:
  cmd.run:
    - name: DEBIAN_FRONTEND=noninteractive apt-get -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" dist-upgrade
    - require:
      - pkg: update_package_cache
