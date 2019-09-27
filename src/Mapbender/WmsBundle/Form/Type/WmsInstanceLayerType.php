<?php

namespace Mapbender\WmsBundle\Form\Type;

use Mapbender\WmsBundle\Entity\WmsInstanceLayer;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\FormBuilderInterface;
use Mapbender\WmsBundle\Form\EventListener\FieldSubscriber;
use Symfony\Component\Form\FormInterface;
use Symfony\Component\Form\FormView;

class WmsInstanceLayerType extends AbstractType
{

    /**
     * @inheritdoc
     */
    public function getName()
    {
        return 'wmsinstancelayer';
    }

    /**
     * @inheritdoc
     */
    public function buildForm(FormBuilderInterface $builder, array $options)
    {
        $subscriber = new FieldSubscriber();
        $builder->addEventSubscriber($subscriber);
        $builder
            ->add('title', 'text', array(
                'required' => false,
                'label' => 'mb.wms.wmsloader.repo.instancelayerform.label.layerstitle',
            ))
            ->add('active', 'checkbox', array(
                'required' => false,
                'label' => 'mb.wms.wmsloader.repo.instancelayerform.label.active',
            ))
            ->add('selected', 'checkbox', array(
                'required' => false,
                'label' => 'mb.wms.wmsloader.repo.instancelayerform.label.selectedtoc',
            ))
            ->add('info', 'checkbox', array(
                'required' => false,
                'label' => 'mb.wms.wmsloader.repo.instancelayerform.label.infotoc',
            ))
            ->add('toggle', 'checkbox', array(
                'required' => false,
                'label' => 'mb.wms.wmsloader.repo.instancelayerform.label.toggletoc',
            ))
            ->add('allowselected', 'checkbox', array(
                'required' => false,
                'label' => "mb.wms.wmsloader.repo.instancelayerform.label.allowselecttoc",
            ))
            ->add('allowinfo', 'checkbox', array(
                'required' => false,
                'label' => 'mb.wms.wmsloader.repo.instancelayerform.label.allowinfotoc',
            ))
            ->add('allowtoggle', 'checkbox', array(
                'required' => false,
                'label' => 'mb.wms.wmsloader.repo.instancelayerform.label.allowtoggletoc',
            ))
            ->add('allowreorder', 'checkbox', array(
                'required' => false,
                'label' => 'mb.wms.wmsloader.repo.instancelayerform.label.allowreordertoc',
            ))
            ->add('minScale', 'text', array(
                'required' => false,
                'label' => 'mb.wms.wmsloader.repo.instancelayerform.label.minscale',
            ))
            ->add('maxScale', 'text', array(
                'required' => false,
                'label' => 'mb.wms.wmsloader.repo.instancelayerform.label.maxsclase',   // sic!
            ))
            ->add('priority', 'hidden', array(
                'required' => true,
            ))
        ;
    }

    public function finishView(FormView $view, FormInterface $form, array $options)
    {
        /** @var WmsInstanceLayer $layer */
        $layer = $form->getData();
        $hasSubLayers = !!$layer->getSublayer()->count();

        $view['title']->vars['attr'] = array(
            'placeholder' => $layer->getSourceItem()->getTitle(),
        );
        $view['toggle']->vars['disabled'] = !$hasSubLayers;
        $view['allowtoggle']->vars['disabled'] = !$hasSubLayers;
        if (!$hasSubLayers) {
            $form['toggle']->setData(false);
            $form['allowtoggle']->setData(false);
        }

        $isQueryable = $layer->getSourceItem()->getQueryable();
        $view['info']->vars['disabled'] = !$isQueryable;
        $view['allowinfo']->vars['disabled'] = !$isQueryable;
        if (!$isQueryable) {
            $form['info']->setData(false);
            $form['allowinfo']->setData(false);
        }
        $view['minScale']->vars['attr'] = array(
            'placeholder' => $layer->getInheritedMinScale(),
        );
        $view['maxScale']->vars['attr'] = array(
            'placeholder' => $layer->getInheritedMaxScale(),
        );
        parent::finishView($view, $form, $options);
    }
}
