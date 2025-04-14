# Configure clients to use local repository
configure_apt_sources:
  file.managed:
    - name: /etc/apt/sources.list
    - contents: |
        deb http://192.168.0.10/ubuntu/ {{ salt['grains.get']('oscodename') }} main restricted universe multiverse
        deb http://192.168.0.10/ubuntu/ {{ salt['grains.get']('oscodename') }}-updates main restricted universe multiverse
        deb http://192.168.0.10/ubuntu/ {{ salt['grains.get']('oscodename') }}-security main restricted universe multiverse
        deb http://192.168.0.10/ubuntu/ {{ salt['grains.get']('oscodename') }}-backports main restricted universe multiverse
    - template: jinja
    - backup: '.bak'

force_apt_cache_update:
  pkg.update:
    - refresh: true
    - require:
      - file: configure_apt_sources
