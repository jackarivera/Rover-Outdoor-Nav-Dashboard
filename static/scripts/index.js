var mode = 'moveAround'; // The current mode
var def_ko_loaded = false;
// Initialize an empty array to hold the coordinates of the waypoints
var waypoints = [];
var wp_markers = [];

// Array for keepout zones
var keepout_zones = [];

function toggleLoadDefKeepoutZones() {
    // Get a reference to the button element
    var button = document.getElementById('loadDefKeepoutZones');

    // Update the button text based on the current state
    if (def_ko_loaded) {
        def_ko_loaded = !def_ko_loaded;
        removeWaterKeepout();
        button.innerHTML = '<img src="/static/icons/up-arrow.png" class="icon" id="defKeepZoneIcon"/>Load Default Keepout Zones';
    } else {
        def_ko_loaded = !def_ko_loaded;
        drawWaterKeepout();
        button.innerHTML = '<img src="/static/icons/down-arrow.png" class="icon" id="defKeepZoneIcon"/>Unload Default Keepout Zones';
    }
}
// Assign click handlers to the toolbar buttons
$('#moveAround').click(function() {
    mode = 'moveAround';
    toggleWaypointsCursor(mode);
});
$('#addWaypoints').click(function() {
    mode = 'addWaypoints';
    toggleWaypointsCursor(mode);
});
$('#clearWaypoints').click(function() {
    mode = 'addWaypoints';
    toggleWaypointsCursor(mode);
    clearWaypoints();
});
$('#addKeepoutZones').click(function() {
    mode = 'addKeepoutZones';
    toggleWaypointsCursor(mode);
    // TODO: Implement this functionality
});
$('#loadDefKeepoutZones').click(function() {
    toggleLoadDefKeepoutZones();
});
$('#saveMission').click(function() {
    var missionFilename = $('#saveMissionFilename').val().trim(); // Get the input value and remove leading/trailing spaces
    if (missionFilename === '') {
        addLog('Mission filename is empty.', 'error');
        $('#saveMissionFilename').css('border-color', 'red');
        return;
    }

    $.ajax({
        url: '/save_mission',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({"file_name": missionFilename}),
        success: function(result) {
            addLog(result, 'success', 'MISSION');
            $('#saveMissionFilename').css('border-color', '');
        },
        error: function(error) {
            addLog(result, 'error', 'MISSION');
            $('#saveMissionFilename').css('border-color', 'red');
        }
    });
});
$('#loadMission').click(function() {
    var missionFilename = $('#loadMissionFilename').val().trim(); // Get the input value and remove leading/trailing spaces
    if (missionFilename === '') {
        console.log('Mission filename is empty.');
        $('#loadMissionFilename').css('border-color', 'red');
        return;
    }
    $.ajax({
        url: '/load_mission',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({"file_name": missionFilename}),
        success: function(response) {
            $('#loadMissionFilename').css('border-color', '');
            clearWaypoints(); // Clear old waypoints first

            var loadedWaypoints = response.coordinates;
            // Add the robot's current position as the first waypoint
            waypoints = [robotMarker.getLatLng()]
            // Add the loaded waypoints to the map and waypoints array
            for (var i = 0; i < loadedWaypoints.length; i++) {
                let new_wp = {
                    lat: loadedWaypoints[i][0],
                    lng: loadedWaypoints[i][1]
                };
                addWaypoint(new_wp);
            }
            updatePolyline();
        },
        error: function(error) {
            console.log(error);
            $('#loadMissionFilename').css('border-color', 'red');
        }
    });
});
$('#switchView').click(function() {
    if (map.hasLayer(mapView)) {
        map.removeLayer(mapView);
        satelliteView.addTo(map);
    } else {
        map.removeLayer(satelliteView);
        mapView.addTo(map);
    }
});
$('#export').click(function() {
    var waypointsFilename = $('#waypointsFilename').val().trim();

    // Check if missionFilename is empty or only contains spaces
    if (waypointsFilename === '') {
        // Handle the case when the input is empty
        console.log('Waypoints filename is empty.');
        $('#waypointsFilename').css('border-color', 'red');
        return;
    }
    $.ajax({
        url: '/export_waypoints',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({"file_name": waypointsFilename}),
        success: function(result) {
            console.log(result);
            $('#waypointsFilename').css('border-color', '');
        },
        error: function(error) {
            console.log(error);
            $('#waypointsFilename').css('border-color', 'red');
        }
    });
});

var map = L.map('map', {
    contextmenu: true,
    contextmenuWidth: 140,
    contextmenuItems: [],
    maxZoom: 25
}).setView([44.96945, -93.5174], 18);

var mapView = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxNativeZoom: 19,
    maxZoom: 25
}).addTo(map);

var satelliteView = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
    attribution: '&copy; <a href="https://www.google.com/">Google</a> contributors',
    maxNativeZoom: 22,
    maxZoom: 25
});

// Add robot marker
var robotIcon = L.icon({
    iconUrl: '/static/icons/gps_arrow_icon.png',
    iconSize: [24, 24],
});

var robotMarker = L.marker([44.96945, -93.5174], {icon: robotIcon, rotationAngle: 0}).addTo(map);
robotMarker.bindPopup("<b>Robot Position:</b><br>Lat: " + robotMarker.getLatLng().lat + "<br>Lon: " + robotMarker.getLatLng().lng);
waypoints.push(robotMarker.getLatLng());
setRobotPosition(44.969560624494676, -93.5171673638741, 180);

map.on('click', function(e) {
    if (mode === 'addWaypoints') {
        addWaypoint(e.latlng);
    }
});

var defaultKeepoutZonesLayer;
// Load GeoJSON data from your JSON file
function drawWaterKeepout() {
    fetch('/static/zones/default_keepout_zones.json')
        .then(response => response.json())
        .then(geoJSONData => {
            // Create a Leaflet GeoJSON layer with the GeoJSON data and style it with light orange color
            defaultKeepoutZonesLayer = L.geoJSON(geoJSONData, {
                style: {
                    fillColor: '#FFD700', // Light orange color
                    fillOpacity: 0.4,
                    color: '#FFA500', // Orange border color
                    weight: 2
                }
            }).addTo(map);
        })
        .catch(error => console.log(error));

    keepout_zones.push(defaultKeepoutZonesLayer);
}

function removeWaterKeepout() {
    if (defaultKeepoutZonesLayer) {
        map.removeLayer(defaultKeepoutZonesLayer);
    }
    
    var index = keepout_zones.findIndex(function(zone) {
        return defaultKeepoutZonesLayer;
    });

    if (index !== -1) {
        keepout_zones.splice(index, 1);
    }
}



// Initialize an empty Leaflet Polyline object
var polyline = L.polyline([], { color: 'blue' }).addTo(map);

function toggleWaypointsCursor(addWaypointsMode) {
    if (addWaypointsMode === 'addWaypoints') {
        // Add the custom cursor class when in "addWaypoints" mode
        L.DomUtil.addClass(map._container,'add-waypoints-cursor');
    } else {
        // Remove the custom cursor class when not in "addWaypoints" mode
        L.DomUtil.removeClass(map._container,'add-waypoints-cursor');
    }
}

function removeWaypoint(marker) {
    // Remove the waypoint from the waypoints array
    var latlng = marker.getLatLng();
    var index = waypoints.findIndex(function(waypoint) {
        return waypoint.lat === latlng.lat && waypoint.lng === latlng.lng;
    });

    if (index !== -1) {
        waypoints.splice(index, 1);

        // Update the polyline to connect all waypoints after removal
        updatePolyline();
    }

    $.ajax({
        url: '/del_waypoint',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({lat: latlng.lat, lng: latlng.lng}),
        success: function(result) {
            console.log(result);
        },
        error: function(error) {
            console.log(error);
        }
    });
    addLog("Removed Waypoint: [" + latlng.lat + ", " + latlng.lng + "]", 'info');
}

function updateWaypoint(oldLatLng, newLatLng) {
    // Find the index of the dragged waypoint in the waypoints array
    var index = waypoints.findIndex(function (waypoint) {
        return waypoint.lat === oldLatLng.lat && waypoint.lng === oldLatLng.lng;
    });

    if (index !== -1) {
        // Update the waypoints array with the new position
        waypoints[index] = newLatLng;

        // Update the polyline to connect all waypoints after dragging
        updatePolyline();
    }
    $.ajax({
            url: '/update_waypoint',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({old_lat: oldLatLng.lat, old_lng: oldLatLng.lng, new_lat: newLatLng.lat, new_lng: newLatLng.lng}),
            success: function(result) {
                console.log(result);
            },
            error: function(error) {
                console.log(error);
            }
    });
    addLog("Updated Waypoint: [" + oldLatLng.lat + ", " + oldLatLng.lng + "] -> [" + newLatLng.lat + ", " + newLatLng.lng + "]", 'info');
}

function addWaypoint(latlng) {
    console.log(latlng);
    var marker = L.marker(latlng, {
            draggable: true,
            contextmenu: true,
            contextmenuItems: [{
                text: 'Remove marker',
                callback: function() {
                    map.removeLayer(marker);
                    removeWaypoint(marker);
                }
            }]
    }).addTo(map);
    marker.bindPopup("<b>Waypoint:</b><br>Lat: " + latlng.lat + "<br>Lon: " + latlng.lng);
    // Add a dragend event listener to the marker
    var markerOldLatLng;
    marker.on('dragstart', function (event) {
        markerOldLatLng = marker.getLatLng();
    });
    marker.on('dragend', function (event) {
        var newLatLng = event.target.getLatLng();
        marker.bindPopup("<b>Waypoint:</b><br>Lat: " + newLatLng.lat + "<br>Lon: " + newLatLng.lng);
        updateWaypoint(markerOldLatLng, newLatLng);
        updatePolyline();
    });
    // Add the new latlng to the waypoints array
    waypoints.push(latlng);
    wp_markers.push(marker);

    // Update the polyline to connect all waypoints
    updatePolyline();

    $.ajax({
            url: '/add_waypoint',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({lat: latlng.lat, lng: latlng.lng}),
            success: function(result) {
                console.log(result);
            },
            error: function(error) {
                console.log(error);
            }
    });
    addLog("Added Waypoint: [" + latlng.lat + ", " + latlng.lng + "]", 'info');
}

function clearWaypoints() {
    wp_markers.forEach(function(marker) {
        map.removeLayer(marker);
    });

    // Clear the waypoints array
    waypoints = [robotMarker.getLatLng()];
    wp_markers = [];

    updatePolyline()

    $.ajax({
            url: '/clear_waypoints',
            method: 'GET',
            success: function(result) {
                console.log(result);
            },
            error: function(error) {
                console.log(error);
            }
    });
    addLog("Cleared all Waypoints.", 'info');
}

// Function to update the polyline based on the waypoints array
function updatePolyline() {
    polyline.setLatLngs(waypoints);
}

function setRobotPosition(lat, lng, rot) {
    r_pos = robotMarker.getLatLng();
    robotMarker.setLatLng([lat, lng]);
    robotMarker.setRotationAngle(rot);
    robotMarker.bindPopup("<b>Robot Position:</b><br>Lat: " + robotMarker.getLatLng().lat + "<br>Lon: " + robotMarker.getLatLng().lng + "<br>Heading: " + rot);
    waypoints.splice(0, 1);
    waypoints.unshift(robotMarker.getLatLng());
    
}

socket.on('gps_data', (data) => {
    handleGpsData(data.lat, data.lng);
});

socket.on('imu_data', (data) => {
    handleImuData(data.rotation);
});

function handleGpsData(lat, lng) {
    addLog(`GPS Data Received. Latitude: ${lat}, Longitude: ${lng}`, 'info', 'GPS');
    setRobotPosition(lat, lng, robotMarker.getRotationAngle());
    updatePolyline();
}

function handleImuData(rotation) {
    adjusted_rot = rotation;
    addLog(`IMU Data Received. Rotation: ${adjusted_rot}`, 'info', 'GPS');
    setRobotPosition(robotMarker.getLatLng().lat, robotMarker.getLatLng().lng, adjusted_rot);
}