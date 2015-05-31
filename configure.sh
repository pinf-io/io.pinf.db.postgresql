#!/bin/bash
# Source https://github.com/cadorn/bash.origin
. "$BO_ROOT_SCRIPT_PATH"
function init {
	eval BO_SELF_BASH_SOURCE="$BO_READ_SELF_BASH_SOURCE"
	BO_deriveSelfDir ___TMP___ "$BO_SELF_BASH_SOURCE"
	PGS_DIR="$___TMP___"


	BO_format "$VERBOSE" "HEADER" "Install and configure PostgreSQL"

	sudo apt-get install -y postgresql postgresql-contrib

	BO_run_node "$PGS_DIR/configure.js"

	BO_format "$VERBOSE" "FOOTER"
}
init $@