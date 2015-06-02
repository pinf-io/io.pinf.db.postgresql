
const SPAWN = require("child_process").spawn;


require('org.pinf.genesis.lib').forModule(require, module, function (API, exports) {

	function runCommands (commands) {
		API.console.verbose("Running commands:", commands);
		var deferred = API.Q.defer();
		var proc = SPAWN("/bin/bash", [
			"-e", "-s"
		], {
			cwd: process.env.PIO_SERVICE_LIVE_INSTALL_DIRPATH,
	        env: process.env
	    });
	    var stdout = [];
	    proc.stdout.on('data', function (data) {
	    	if (API.VERBOSE) {
		        process.stdout.write(data);
		    }
		    stdout.push(data.toString());
	    });
	    proc.stderr.on('data', function (data) {
	        process.stderr.write(data);
	    });
	    proc.on('close', function (code) {
	        if (code !== 0) {
	            console.error("ERROR: Commands exited with code '" + code + "'");
	            return deferred.reject(new Error("Commands exited with code '" + code + "'"));
	        }
	        return deferred.resolve(stdout.join(""));
	    });
		proc.stdin.write(commands.join(";\n"));
	    proc.stdin.end();
	    return deferred.promise;
	}

	function runStatements (statements) {
		API.console.verbose("Running PostgreSQL statements:", statements);
		var deferred = API.Q.defer();
		var proc = SPAWN("/bin/bash", [
			"-e", "-s"
		], {
			cwd: process.env.PIO_SERVICE_LIVE_INSTALL_DIRPATH,
	        env: process.env
	    });
	    var stdout = [];
	    proc.stdout.on('data', function (data) {
	    	if (API.VERBOSE) {
		        process.stdout.write(data);
		    }
		    stdout.push(data.toString());
	    });
	    proc.stderr.on('data', function (data) {
	        process.stderr.write(data);
	    });
	    proc.on('close', function (code) {
	        if (code !== 0) {
	            console.error("ERROR: Commands exited with code '" + code + "'");
	            return deferred.reject(new Error("Commands exited with code '" + code + "'"));
	        }
	        return deferred.resolve(stdout.join(""));
	    });
		proc.stdin.write([
			"sudo -u postgres -i",
			"psql <<OMG",
			statements.join(";\n") + ";",
			"OMG"
		].join("\n"));
	    proc.stdin.end();
	    return deferred.promise;
	}

	function ensureRole (roleName, password) {
		return runStatements([
			"SELECT * FROM pg_catalog.pg_user WHERE usename = '" + roleName + "'"
		]).then(function (result) {
			if (/\(1 row\)/.test(result)) {
				// Role exists.
				return;
			}
			return runStatements([
				"CREATE ROLE " + roleName + " LOGIN PASSWORD '" + password.replace(/'/g, "\\'") + "';"
			]);
		});
	}

	function ensureDatabase (databaseName) {
		return runStatements([
			"SELECT * FROM pg_database WHERE datname = '" + databaseName + "'"
		]).then(function (result) {
			if (/\(1 row\)/.test(result)) {
				// Database exists.
				return;
			}
			return runStatements([
				"CREATE DATABASE " + databaseName
			]);
		});
	}

	function configureServer () {

		function configure_postgresql () {
			// Ubuntu
			// TODO: Find paths in all environments.
			var configData = API.FS.readFileSync("/etc/postgresql/9.3/main/postgresql.conf", "utf8");
			var configChanged = false;
			var m = null;


			m = configData.match(/^(#?)(listen_addresses = ')([^']+)(')/m);
			if (m[1] === "#" || m[3] !== API.config.bind) {
				configData = configData.replace(m[0], m[2] + API.config.bind + m[4]);
				configChanged = true;
			}

			m = configData.match(/^(#?)(port = )(\d+)/m);
			if (m[1] === "#" || m[3] != API.config.port) {
				configData = configData.replace(m[0], m[2] + API.config.port);
				configChanged = true;
			}


			if (!configChanged) {
				return API.Q.resolve();
			}

			return runCommands([
				"sudo service postgresql stop"
			]).then(function () {

				API.FS.writeFileSync("/etc/postgresql/9.3/main/postgresql.conf", configData, "utf8");

				return runCommands([
					"sudo service postgresql start"
				]);
			});
		}

		function configure_pg_hba () {
			// Ubuntu
			// TODO: Find paths in all environments.
			var configData = API.FS.readFileSync("/etc/postgresql/9.3/main/pg_hba.conf", "utf8");
			var configChanged = false;
			var m = null;


			m = configData.match(/^(#?)(listen_addresses = ')([^']+)(')$/m);
			if (!/^host\tall\tall\t0\.0\.0\.0\/0\tmd5$/m.test(configData)) {
				configData += "\nhost\tall\tall\t0.0.0.0/0\tmd5\n";
				configChanged = true;
			}


			if (!configChanged) {
				return API.Q.resolve();
			}

			// TODO: Just send 'SIGHUP' to postmaster.
			return runCommands([
				"sudo service postgresql stop"
			]).then(function () {

				API.FS.writeFileSync("/etc/postgresql/9.3/main/pg_hba.conf", configData, "utf8");

				return runCommands([
					"sudo service postgresql start"
				]);
			});
		}

		return configure_postgresql().then(function () {

			return configure_pg_hba();
		});
	}

	function ensureRoles () {
		API.console.verbose("Ensuring roles", API.config.roles);
		if (!API.config.roles) {
			return API.Q.resolve();
		}
		return API.Q.all(Object.keys(API.config.roles).map(function (roleName) {
			return ensureRole(roleName, API.config.roles[roleName].password);
		}));
	}

	function ensureDatabases () {
		API.console.verbose("Ensuring databases", API.config.databases);
		if (!API.config.databases) {
			return API.Q.resolve();
		}
		return API.Q.all(Object.keys(API.config.databases).map(ensureDatabase));
	}

	if (!API.config) {
		API.console.verbose("No config. No roles nor databases to ensure.");
		return;
	}

	return configureServer().then(function () {
		return ensureRoles().then(function () {
			return ensureDatabases();
		});
	});
});


