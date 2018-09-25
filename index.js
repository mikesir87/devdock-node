const exec = require('child_process').exec;
const spawn = require('child_process').spawn;
const fs = require("fs");
const YAML = require('yamljs');
const homedir = require('os').homedir();
const term = require( 'terminal-kit' ).terminal ;


let args = [...process.argv.slice(2)];
if (args.length < 2) {
    console.log(`Usage:`);
    console.log(`  devdock [PROJECT-NAME] [APP-IMAGE]`);
    console.log(`  devdock [PROJECT-NAME] [APP-IMAGE] [DOCKER-COMPOSE-COMMAND w/ flags and options]`);
    process.exit(1);
}

const appName = args.shift();
const appImage = args.shift();
const uppercasedName = appName.charAt(0).toUpperCase() + appName.slice(1);


term.on("key" , function( key , matches , data ) {  
    if (key === "CTRL_C" ) { process.exit() ; }
} ) ;

if (!fs.existsSync(`${homedir}/.devdock`)) {
    fs.mkdirSync(`${homedir}/.devdock`);
}


function getAppYaml(appName) {
    return new Promise((accept, reject) => {
        exec(`docker-app render ${appName}`, (err, stdout, stderr) => {
            if (err) return reject(stderr);
            accept(stdout);
        })
    });
}

function extractServices(composeJson) {
    return Object.keys(composeJson.services)
        .filter((serviceName) => composeJson.services[serviceName]['x-devdock-description'] !== undefined)
        .reduce((prev, curr) => [
            ...prev, 
            { 
                name : curr, 
                description : composeJson.services[curr]['x-devdock-description'],
                setting : composeJson.services[curr]['x-devdock-setting-name'],
            }
        ], [])
}

function getCurrentSettings(appName) {
    if (fs.existsSync(`${homedir}/.devdock/settings.json`)) {
        const data = JSON.parse(fs.readFileSync(`${homedir}/.devdock/settings.json`).toString());
        if (appName === undefined)
            return data;
        return (data[appName]) ? data[appName] : [];
    }
    return (appName === undefined) ? {} : [];
}

async function getSettings(name, appYaml) {
    return Promise.resolve(YAML.parse(appYaml))
        .then(extractServices)
        .then((services) => Promise.all([ services, getCurrentSettings(name) ]))
        .then(([ services, settings ]) => 
            services.map((service) => 
                Object.assign({}, service, { disabled : settings.indexOf(service.name) > -1} )
            )
        )
        .then((services) => services.sort((a, b) => a.description < b.description ? -1 : 1))
        .catch(console.error);
}

async function showMenu(name, settings, selectedIndex = 0) {
    term.clear();

    const spacer = Array(Math.floor((48 - 9 - name.length) / 2)).join(' ');
    term.cyan( '************************************************\n' );
    term.cyan( `${spacer}${uppercasedName}-in-a-Box\n` );
    term.cyan( '************************************************\n\n' );
    term( 'What services would you like to disable?\n' ) ;

    const items = [
        ...settings
            .map((setting, index) => `${index + 1}. ${setting.description} ${setting.disabled ? '(disabled)' : ''}`),
        "Done"
    ];

    const response = await term.singleColumnMenu( items, { exitOnUnexpectedKey : true, leftPadding : "  ", selectedIndex } ).promise;
    if (response.selectedIndex !== undefined && response.selectedIndex < settings.length) {
        const updatedSetting = Object.assign({}, settings[response.selectedIndex], { disabled : !settings[response.selectedIndex].disabled });
        const updatedSettings = [...settings.slice(0, response.selectedIndex), updatedSetting, ...settings.slice(response.selectedIndex + 1)];
        return showMenu(name, updatedSettings, response.selectedIndex);
    }

    term.clear();
    return settings;    
}

async function persistSettingsIfNeeded(name, oldSettings, updatedSettings) {
    const newDisabledServices = updatedSettings.filter(s => s.disabled).map(s => s.name);
    const oldDisabledServices = oldSettings.filter(s => s.disabled).map(s => s.name);
    if (newDisabledServices.length === oldDisabledServices.length &&
            newDisabledServices.filter(s => oldDisabledServices.indexOf(s) === -1).length === 0) {
        return;
    }

    const currentSettings = getCurrentSettings();
    currentSettings[name] = newDisabledServices;
    fs.writeFileSync(`${homedir}/.devdock/settings.json`, JSON.stringify(currentSettings));
}

async function renderDockerApp(appImage, appName, settings) {
    return new Promise((accept, reject) => {
        const appSettings = settings.filter(s => s.disabled)
            .map(s => `-s ${s.setting}=false`)
            .join(' ');

        exec(`docker-app render ${appSettings} ${appImage}`, (err, stdout, stderr) => {
            if (err) return reject(stderr);
            fs.writeFileSync(`${homedir}/.devdock/${appName}.yml`, stdout);
            accept(stdout);
        })
    });
}

async function startDockerCompose(appName, args) {
    return new Promise((accept, reject) => {
        const process = spawn('docker-compose', [`-f`, `${homedir}/.devdock/${appName}.yml`, `-p`, `${appName}`, ...args], { stdio: 'inherit' });
        process.on("exit", () => accept());
    });
}

async function run() {
    const appYaml = await getAppYaml(appImage);
    const settings = await getSettings(appName, appYaml);
    let updatedSettings = null;

    if (settings.length === 0) {
        console.error("No available services were found in the app!");
        process.exit(1);
    }
    

    if (args.length === 0) {
        args = ["up", "-d", "--remove-orphans"]   

        updatedSettings = await showMenu(appName, settings);
        if (updatedSettings === undefined)
            process.exit(1);
        await persistSettingsIfNeeded(appName, settings, updatedSettings); 

        const disabledServices = updatedSettings.filter(s => s.disabled);
        if (disabledServices.length > 0) {
            console.log(`Running ${appName} with the following services disabled`);
            updatedSettings.filter(s => s.disabled).forEach(s => console.log(` -- ${s.description}`));
        }
        else {
            console.log(`Running ${appName} with no disabled services`);
        }
    }
    else {
        updatedSettings = settings;
    }

    await renderDockerApp(appImage, appName, updatedSettings);
    await startDockerCompose(appName, args);
    process.exit();
}

run()
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
