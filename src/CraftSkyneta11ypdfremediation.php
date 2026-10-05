<?php

namespace skynettechnologies\craftskyneta11ypdfremediation;

use Craft;
use craft\base\Plugin;
use craft\base\Model;
use skynettechnologies\craftskyneta11ypdfremediation\models\Settings;

class CraftSkyneta11ypdfremediation extends Plugin
{
    public static $plugin;

    public string $schemaVersion = '2.0.0';

    public bool $hasCpSettings = true;

    public bool $hasCpSection = false;

    public function init(): void
    {
        parent::init();

        self::$plugin = $this;
    }

    protected function createSettingsModel(): ?Model
    {
        return new Settings();
    }

    protected function settingsHtml(): ?string
    {
        \skynettechnologies\craftskyneta11ypdfremediation\assetbundles\AdminSettingsAsset::register(
            Craft::$app->getView()
        );

        $phpFile = __DIR__ . '/templates/setting.php';

        if (file_exists($phpFile)) {
            ob_start();

            include $phpFile;

            $output = ob_get_clean();

            return Craft::$app->view->renderTemplate(
                'craft-skyneta11ypdfremediation/template',
                [
                    'content' => $output
                ]
            );
        }

        return '';
    }
}