<?php

namespace Mapbender\ManagerBundle\Template;

use Mapbender\Component\Application\TemplateAssetDependencyInterface;

class ManagerTemplate implements TemplateAssetDependencyInterface
{
    public function getAssets($type)
    {
        switch ($type) {
            case 'css':
                return array(
                    '@MapbenderManagerBundle/Resources/public/sass/manager/applications.scss',
                );
            case 'js':
                return array(
                    '/components/jquerydialogextendjs/jquerydialogextendjs-built.js',
                    '/components/vis-ui.js/vis-ui.js-built.js',

                    '@FOMCoreBundle/Resources/public/js/widgets/dropdown.js',
                    '@FOMCoreBundle/Resources/public/js/widgets/checkbox.js',
                    '@FOMCoreBundle/Resources/public/js/components.js',
                    '@FOMCoreBundle/Resources/public/js/widgets/collection.js',
                    '@MapbenderCoreBundle/Resources/public/mapbender.trans.js',
                    '@MapbenderManagerBundle/Resources/public/js/confirm-delete.js',
                );
            case 'trans':
                return array(
                    '@MapbenderManagerBundle/Resources/views/translations.json.twig',
                );
            default:
                throw new \InvalidArgumentException("Unsupported asset type " . print_r($type, true));
        }
    }

    public function getLateAssets($type)
    {
        switch ($type) {
            case 'css':
            case 'js':
            case 'trans':
                return array();
            default:
                throw new \InvalidArgumentException("Unsupported asset type " . print_r($type, true));
        }
    }
}
