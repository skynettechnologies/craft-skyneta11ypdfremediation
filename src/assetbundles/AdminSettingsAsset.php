<?php

namespace skynettechnologies\craftskyneta11ypdfremediation\assetbundles;

use craft\web\AssetBundle;
use craft\web\assets\cp\CpAsset;

class AdminSettingsAsset extends AssetBundle
{
    public function init()
    {
        // Set the path where your resources are located
        $this->sourcePath = "@skynettechnologies/craftskyneta11ypdfremediation/resources";

        // Define the CSS files to be included   
        $this->css = [
            'css/style.css',
        ];
        $this->js = [
            'js/account.js',
            'js/config.js',
            'js/api.js',
            'js/icons.js',
            'js/app.js',
        ];

        // Define the dependencies
        $this->depends = [
            CpAsset::class, // Ensures Craft's Control Panel styles and scripts are loaded
        ];

        parent::init();
    }
}
