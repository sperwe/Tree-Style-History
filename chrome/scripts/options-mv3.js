// MV3 compatible options.js
document.addEventListener('DOMContentLoaded', function () {
    // Fade in effect (simplified)
    var optionsElement = document.getElementById('options');
    if (optionsElement) {
        optionsElement.style.opacity = '0';
        optionsElement.style.transition = 'opacity 0.25s ease-in-out';
        setTimeout(function() {
            optionsElement.style.opacity = '1';
        }, 10);
    }

    // Set version
    var versionElement = document.getElementById('version');
    if (versionElement) {
        versionElement.textContent = getVersion();
    }

    // URL Vars
    var vars = getUrlVars();

    if (vars['p'] == undefined) {
        document.getElementById('tab-options-content').style.display = 'block';
        document.getElementById('tab-options').classList.add('tab-current');
    } else {
        document.getElementById('tab-' + vars['p'] + '-content').style.display = 'block';
        document.getElementById('tab-' + vars['p']).classList.add('tab-current');
    }

    // Options tabs
    document.querySelectorAll('.tab').forEach(function(tab) {
        tab.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            
            document.querySelectorAll('.tab-content').forEach(function(content) {
                content.style.display = 'none';
            });
            document.querySelectorAll('.tab').forEach(function(tab) {
                tab.classList.remove('tab-current');
            });
            
            document.getElementById(this.id + '-content').style.display = 'block';
            this.classList.add('tab-current');
        });
    });

    // Load translated text
    loadOptionsLang();

    // Load saved options
    loadOptions(true);

    // Save options
    var saveButton = document.getElementById('save');
    if (saveButton) {
        saveButton.addEventListener('click', function () {
            saveOptions(false);
        });
    }

    // Default config
    var defaultConfigButton = document.getElementById('defaultConfig');
    if (defaultConfigButton) {
        defaultConfigButton.value = returnLang('defaultConfig');
        defaultConfigButton.addEventListener('click', function () {
            defaultConfig(true);
            location.reload();
        });
    }

    // Delete cache
    var deleteCacheButton = document.getElementById('deleteCache');
    if (deleteCacheButton) {
        deleteCacheButton.addEventListener('click', function () {
            chrome.runtime.sendMessage({ action: 'deleteDb' }, function(response) {
                if (response && response.success) {
                    alert('Cache deleted successfully');
                } else {
                    alert('Failed to delete cache: ' + (response ? response.error : 'Unknown error'));
                }
            });
        });
    }

    // Shortcuts
    var shortcutsButton = document.getElementById('shortcuts');
    if (shortcutsButton) {
        shortcutsButton.addEventListener('click', function () {
            chromeURL('chrome://extensions/shortcuts');
        });
    }

    // Save upload
    var saveUploadButton = document.getElementById('saveUpload');
    if (saveUploadButton) {
        saveUploadButton.value = returnLang('saveUpload');
        saveUploadButton.addEventListener('click', function () {
            saveOptions(true);
        });
    }

    // Download config
    var downloadConfigButton = document.getElementById('downloadConfig');
    if (downloadConfigButton) {
        downloadConfigButton.value = returnLang('downloadConfig');
        downloadConfigButton.addEventListener('click', function () {
            downloadOptions();
        });
    }

    var downloadConfig2Button = document.getElementById('downloadConfig2');
    if (downloadConfig2Button) {
        downloadConfig2Button.value = returnLang('downloadConfig2');
        downloadConfig2Button.addEventListener('click', function () {
            // Implementation would go here
        });
    }

    // Sliders
    loadSlider('rhitemsno', 0, 100, 'rh-itemsno');
    loadSlider('rctitemsno', 0, 100, 'rct-itemsno');
    loadSlider('rtitemsno', 0, 100, 'rt-itemsno');
    loadSlider('mvitemsno', 0, 100, 'mv-itemsno');
    loadSlider('rbitemsno', 0, 100, 'rb-itemsno');
});

// Helper functions
function getVersion() {
    return '3.1.13';
}

function returnLang(key) {
    const messages = {
        'defaultConfig': 'Default Config',
        'saveUpload': 'Save & Upload',
        'downloadConfig': 'Download Config',
        'downloadConfig2': 'Download Config 2'
    };
    return messages[key] || key;
}

function getUrlVars() {
    var vars = {};
    var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m,key,value) {
        vars[key] = value;
    });
    return vars;
}

function chromeURL(url) {
    if (url.startsWith('chrome://')) {
        chrome.tabs.create({ url: url });
    } else {
        window.open(url);
    }
}

function loadOptionsLang() {
    // Implementation would go here
    console.log('Loading options language');
}

function loadOptions(full) {
    // Implementation would go here
    console.log('Loading options, full:', full);
}

function saveOptions(sync) {
    // Implementation would go here
    console.log('Saving options, sync:', sync);
}

function defaultConfig(clean) {
    // Implementation would go here
    console.log('Default config, clean:', clean);
}

function downloadOptions() {
    // Implementation would go here
    console.log('Downloading options');
}

function loadSlider(id, min, max, storageKey) {
    var slider = document.getElementById(id);
    if (slider) {
        var currentValue = localStorage[storageKey] || min;
        slider.min = min;
        slider.max = max;
        slider.value = currentValue;
        
        var valueDisplay = document.getElementById(id + '-value');
        if (valueDisplay) {
            valueDisplay.textContent = currentValue;
        }
        
        slider.addEventListener('input', function() {
            localStorage[storageKey] = this.value;
            if (valueDisplay) {
                valueDisplay.textContent = this.value;
            }
        });
    }
}