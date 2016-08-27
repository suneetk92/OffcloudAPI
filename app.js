/**
 * Created by Sk on 26-08-2016.
 */
var request = require('request');
var fs = require('fs');
fsmonitor = require('fsmonitor');
var Aria2 = require('aria2');
var requestPromise = require('request-promise');

var loginDetails = {
    method: 'POST',
    url: 'https://offcloud.com/api/login/classic',
    formData: {        username: '',
        password: ''
    },
    jar: true,
    json: true
};

var loginStatus = {
    method: 'GET',
    url: 'https://offcloud.com/api/login/check',
    jar: true,
    json: true
};

var cloudDownloadDetails = {
    method: 'POST',
    url: 'https://offcloud.com/api/cloud/download',
    formData: {},
    jar: true,
    json: true
};

var cloudDownloadStatus = {
    method: 'POST',
    url: 'https://offcloud.com/api/cloud/status',
    formData: {
        requestId: ''
    },
    jar: true,
    json: true
};

var watchFolder = 'C:\\Users\\Sk\\Desktop\\Watch';
var linksFile = 'C:\\Users\\Sk\\Desktop\\OffcloudLinks.txt';

function login(){
    console.log("Trying to login");
    requestPromise(loginDetails)
        .then((response) => {
            if (response.error) {
                console.log(response.error);
            } else getloginDetails(function (id) {
                if (id == 1){
                    console.log("LoggedIn successfully")
                    startWatching();
                }
                else
                    console.log("User not loggedIn")
            });
        }).catch((err) => {
        console.log(err.name);
    });
}


function getloginDetails(cb) {
    //console.log("Check Status");
    requestPromise(loginStatus)
        .then((response) => {
            //console.log(response);
            cb(response.loggedIn);
        }).catch((err) => {
        console.log(err);
        cb(0);
    })
}

function startWatching() {
    console.log("Start watching the folder");
    var monitor = fsmonitor.watch(watchFolder, {
        matches: (relpath) => {
            return relpath.match(/(Links.txt|.torrent)/i) !== null;
        },
        excludes: (relpath) => {
            return relpath.match(/^\$/i) !== null;
        }
    }, (change) => {
        if (change.addedFiles && change.addedFiles[0] != null) {
            console.log("Something happened");
            //console.log("Inside New");
            for (var i in change.addedFiles) {
                //console.log(change.addedFiles[i]);
                if (`${change.addedFiles[i]}` === 'Links.txt') {
                    var fileName = `${watchFolder}\\${change.addedFiles[i]}`;
                    fs.readFile(fileName, 'utf8', function (err, data) {
                        if (err) {
                            return console.log(err);
                        }
                        //console.log(data);
                        //if(data.truncate() != null){
                            var links = data.split('\n');
                            sendData(links, function(status){
                                if(status == 'Done'){
                                    fs.unlink(fileName, () => {console.log('Trying to publish links to offcloud')})
                                }
                            });
                        //}
                    });
                } else {
                    console.log(`A torrent file is found`);
                    var fileName = `${watchFolder}\\${change.addedFiles[i]}`;
                    cloudDownloadDetails.formData.url = fileName;
                    //cloudDownloadDetails.formData.attachment = fileName;

                    console.log(cloudDownloadDetails);
                    console.log(fileName);
                    cloudDownload((status) => {
                        if(status == 'Success')
                            fs.unlink(fileName);
                    });
                }
            }
        }
    });

    monitor.on('change', (changes) => {
    });
}

function sendData(links, cb) {
    for (var j in links) {
        //console.log(`${j} URLs = ${links[j]}`);
        cloudDownloadDetails.formData.url = links[j];
        cloudDownloadDetails.formData.attachment = '';
        //console.log(cloudDownloadDetails);
        cloudDownload(() => {});
    }
    cb('Done');
}

function cloudDownload(callBack) {
    //console.log("Sending data");
    console.log(cloudDownloadDetails);
    requestPromise(cloudDownloadDetails)
        .then((response) => {
            console.log(response);
            if(!response.not_available && !response.error){
                console.log(`Data sent to offcloud: ${response.fileName}`);
                cloudDownloadStatus.formData.requestId = response.requestId;
                setTimeout(() => {CheckCloudDownload( function(status) {
                    if(status == 'downloaded') {
                        console.log(`Ready to download: `);
                        console.log(response);
                        fs.appendFile(linksFile, `${response.url}\n`, () => {console.log("Written in the file")});
                        callBack('Success');
                    }
                })}, 10000);
            }else{
                console.log("Some Error Occurred");
                console.log(response);
                callBack('Failed');
            }
        }).catch((err) => {
        console.log(`Err: ${err}`);
        callBack('Failed');
    })
}
function CheckCloudDownload(cbf) {
    //console.log("Checking status");
    requestPromise(cloudDownloadStatus)
        .then((response) => {
            //console.log(response.status);
            if(`${response.status.status}` == 'downloaded' ){
                //console.log(response);
                cbf('downloaded');
            }else{
                setTimeout(() => {CheckCloudDownload(cbf)}, 60000);
            }
        }).catch((err) => {
        cbf('0');
        console.log(`err: ${err}`);
    })
}

login();
