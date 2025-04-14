# Configure clients to use local repository
configure_apt_sources:
  file.managed:
    - name: /etc/apt/sources.list
    - contents: |
        deb http://10.13.0.88:8080/ubuntu/ {{ salt['grains.get']('oscodename') }} main restricted universe multiverse
        deb http://10.13.0.88:8080/ubuntu/ {{ salt['grains.get']('oscodename') }}-updates main restricted universe multiverse
        deb http://10.13.0.88:8080/ubuntu/ {{ salt['grains.get']('oscodename') }}-security main restricted universe multiverse
        deb http://10.13.0.88:8080/ubuntu/ {{ salt['grains.get']('oscodename') }}-backports main restricted universe multiverse
    - template: jinja
    - backup: '.bak'

force_apt_cache_update:
  cmd.run:
    - name: apt-get update
    - require:
      - file: configure_apt_sources
