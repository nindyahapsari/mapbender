(function($) {
    $.widget("mapbender.mbLayertree", {
        options: {
            type: 'element',
            autoOpen: false,
            useTheme: false,
            target: null,
            showBaseSource: true,
            hideNotToggleable: false,
            hideSelect: false,
            hideInfo: false,
            themes: null,
            menu: []
        },
        model: null,
        template: null,
        menuTemplate: null,
        popup: null,
        created: false,
        loadStarted: {},
        consts: {
            source: "source",
            theme: "theme",
            root: "root",
            group: "group",
            simple: "simple"
        },
        transConst: {
            outOfScale: '',
            outOfBounds: '',
            parentInvisible: ''
        },
        _mobilePane: null,
        _create: function() {
            this.loadStarted = {};
            if (!Mapbender.checkTarget("mbLayertree", this.options.target)) {
                return;
            }
            var self = this;
            this._mobilePane = $(this.element).closest('#mobilePane').get(0) || null;
            Mapbender.elementRegistry.onElementReady(this.options.target, $.proxy(self._setup, self));
        },
        _setup: function() {
            this.transConst.outOfScale = Mapbender.trans("mb.core.layertree.const.outofscale");
            this.transConst.outOfBounds = Mapbender.trans("mb.core.layertree.const.outofbounds");
            this.transConst.parentInvisible = Mapbender.trans("mb.core.layertree.const.parentinvisible");
            this.elementUrl = Mapbender.configuration.application.urls.element + '/' + this.element.attr('id') + '/';
            this.template = $('li', this.element).remove();
            this.template.removeClass('hidden');
            this.menuTemplate = $('.layer-menu', this.template).remove();

            this.model = $("#" + this.options.target).data("mapbenderMbMap").getModel();
            if (this.options.type === 'element') {
                this._createTree();
            } else if (this.options.type === 'dialog' && this.options.autoOpen) {
                this.open();
            }
            this.element.removeClass('hidden');
            this._createEvents();
            this._trigger('ready');
        },
        _createTree: function() {
            var sources = this.model.getSources();
            if (this.created)
                this._unSortable();
            for (var i = (sources.length - 1); i > -1; i--) {
                if (this.options.showBaseSource || !sources[i].configuration.isBaseSource) {
                    var li_s = this._createSourceTree(sources[i]);
                    this._addNode(li_s, sources[i]);
                    this._resetSourceAtTree(sources[i]);
                }
            }

            this._reset();
            this.created = true;
        },
        _addNode: function($toAdd, source) {
            var $targetList = $("ul.layers:first", this.element);
            if (this.options.useTheme) {
                // Collect layerset <=> theme relations
                // @todo 3.1.0: this should happen server-side
                var layerset = this._findLayersetWithSource(source);
                var theme = {};
                $.each(this.options.themes, function(idx, item) {
                    if (item.id === layerset.id)
                        theme = item;
                });
                if (theme.useTheme) {
                    var $layersetEl = this._createThemeNode(layerset, theme);
                    $targetList = $("ul.layers:first", $layersetEl);
                }
            }
            $targetList.append($toAdd);
        },
        _reset: function() {
            this._resetSortable();
            this._resetCheckboxes();
            this._setSourcesCount();
        },
        _createEvents: function() {
            var self = this;
            this.element.on('change', 'input[name="sourceVisibility"]', $.proxy(self._toggleSourceVisibility, self));
            this.element.on('change', 'input[name="selected"]', $.proxy(self._toggleSelected, self));
            this.element.on('change', 'input[name="info"]', $.proxy(self._toggleInfo, self));
            this.element.on('click', '.iconFolder', $.proxy(self._toggleContent, self));
            this.element.on('click', '#delete-all', $.proxy(self._removeAllSources, self));
            this.element.on('click', '.layer-menu-btn', $.proxy(self._toggleMenu, self));
            this.element.on('click', '.selectAll', $.proxy(self._selectAll, self));
            $(document).bind('mbmapsourceloadstart', $.proxy(self._onSourceLoadStart, self));
            $(document).bind('mbmapsourceloadend', $.proxy(self._onSourceLoadEnd, self));
            $(document).bind('mbmapsourceloaderror', $.proxy(self._onSourceLoadError, self));
            $(document).bind('mbmapsourceadded', $.proxy(self._onSourceAdded, self));
            $(document).bind('mbmapsourcechanged', $.proxy(self._onSourceChanged, self));
            $(document).bind('mbmapsourceremoved', $.proxy(self._onSourceRemoved, self));
            $(document).bind('mbmapsourcelayerremoved', $.proxy(this._onSourceLayerRemoved, this));
            if (this._mobilePane) {
                $(this.element).on('click', '.leaveContainer', function() {
                    $('input[name="selected"]', this).click();
                });
            }
        },
        _resetCheckboxes: function() {
            $('input[type="checkbox"]', this.element).mbCheckbox();
        },
        _resetSortable: function() {
            this._unSortable();
            this._createSortable();
        },
        _unSortable: function() {
        },
        /**
         * Applies the new (going by DOM) layer order inside a source.
         *
         * @param $sourceContainer
         * @private
         */
        _updateSource: function($sourceContainer) {
            // this will capture the "configurationish" layer ids (e.g. "1_0_4_1") from
            // all layers in the source container in DOM order
            var sourceId = $sourceContainer.attr('data-sourceid');
            var layerIdOrder = [];
            $('li.leave[data-type="simple"]', $sourceContainer).each(function() {
                var $t = $(this);
                var layerId = $t.attr('data-id');
                if (typeof layerId !== "undefined") {
                    layerIdOrder.push("" + layerId);
                }
            });
            this.model.setSourceLayerOrder(sourceId, layerIdOrder.reverse());
        },
        /**
         * Applies the new (going by DOM) ordering between sources.
         *
         * @private
         */
        _updateSourceOrder: function() {
            var $roots = $('ul.layers li[data-type="root"]', this.element);
            var sourceIds = $roots.map(function() {
                return $(this).attr('data-sourceid');
            }).get().reverse();
            this.model.reorderSources(sourceIds);
        },
        _createSortable: function() {
            var self = this;
            $("ul.layers", this.element).each(function() {
                $(this).sortable({
                    axis: 'y',
                    items: "> li:not(.notreorder)",
                    distance: 6,
                    cursor: "move",
                    update: function(event, ui) {
                        var $elm = $(ui.item);
                        var type = $elm.attr('data-type');
                        switch (type) {
                            case 'theme':
                            case 'root':
                                self._updateSourceOrder();
                                break;
                            case 'simple':
                            case 'group':
                                self._updateSource($elm.closest('.serviceContainer'));
                                break;
                            default:
                                console.warn("Warning: unhandled element in layertree sorting", type, $elm);
                                break;
                        }
                    }
                });
            });
        },
        _isThemeVisible: function(layerset) {
            for (var i = 0; i < layerset.content.length; i++) {
                for (id in layerset.content[i]) {
                    if (layerset.content[i][id].configuration.children[0].options.treeOptions.selected) {
                        return true;
                    }
                }
            }
            return false;
        },
        _createThemeNode: function(layerset, theme) {
            var $li = $('ul.layers:first > li[data-layersetid="' + layerset.id + '"]', this.element);
            if ($li.length === 1) {
                return $li;
            } else {
                $li = this.template.clone();
            }
            $('ul.layers:first', this.element).append($li);
            $li.removeClass('hide-elm').addClass('toggleable');
            $li.attr('data-layersetid', layerset.id);
            $li.removeAttr('data-id');
            $li.removeAttr('data-sourceid');
            $li.attr('data-type', this.consts.theme).attr('data-title', layerset.title);
            $li.addClass("themeContainer");
            if (theme.opened)
                $li.addClass("showLeaves").find(".iconFolder").addClass("iconFolderActive");
            else
                $li.removeClass("showLeaves").find(".iconFolder").removeClass("iconFolderActive");
            $('span.layer-title:first', $li).text(layerset.title);
            $('span.layer-spinner:first', $li).remove();
            $('span.layer-state:first', $li).remove();
            $('div.featureInfoWrapper', $li).remove();
            $('div.selectedWrapper', $li).remove();
            if (!theme.allSelected) {
                $('div.selectAll', $li).remove();
            }
            if (!theme.sourceVisibility) {
                $('div.sourceVisibilityWrapper', $li).remove();
            } else {
                $('div.sourceVisibilityWrapper input[name="sourceVisibility"]', $li).prop('checked',
                    this._isThemeVisible(layerset));
            }
            $('.layer-menu-btn', $li).remove();
            return $li;
        },
        _createLayerNode: function(source, sourceEl) {
            var isroot = !sourceEl.getParent();
            var $li = this.template.clone();
            $li.data('layer', sourceEl);

            var config = this._getNodeProporties(sourceEl);
            $li.removeClass('hide-elm');
            $li.attr('data-id', sourceEl.options.id);
            $li.attr('data-sourceid', source.id);
            var nodeType = this._getNodeType(sourceEl, isroot);
            $('div.selectAll', $li).remove();
            $('div.sourceVisibilityWrapper', $li).remove();
            $li.attr('data-type', nodeType).attr('data-title', sourceEl.options.title);
            if (nodeType === this.consts.root || nodeType === this.consts.group) {
                $('.featureInfoWrapper:first', $li).remove();
                if (nodeType === this.consts.root) {
                    $li.addClass("serviceContainer");
                } else if (nodeType === this.consts.group) {
                    $li.addClass("groupContainer");
                }
                if (config.toggle === true) {
                    $li.addClass("showLeaves").find(".iconFolder").addClass("iconFolderActive");
                } else {
                    $li.removeClass("showLeaves").find(".iconFolder").removeClass("iconFolderActive");
                }
                if (config.toggleable) {
                    $li.addClass('toggleable');
                }
            }
            $li.addClass(config.reorder);
            $li.find('.layer-state').attr('title', config.visibility.tooltip);
            this._updateLayerDisplay($li, sourceEl);
            var infoHidden = false;
            if (this.options.hideInfo) {
                infoHidden = true;
                $('input[name="info"]', $li).parents('.checkWrapper:first').remove();
            }
            var selectHidden = false;
            if (this.options.hideSelect && config.selected && !config.selectable &&
                (nodeType === this.consts.root || nodeType === this.consts.group)) {
                selectHidden = true;
                $('input[name="selected"]', $li).parents('.checkWrapper:first').remove();
            }
            if (config.toggleable === false && this.options.hideNotToggleable) {
                var $folder = $li.find('.iconFolder');
                if (selectHidden && infoHidden) {
                    $folder.addClass('placeholder')
                }
                $folder.removeClass('iconFolder');
            }
            $li.find('.layer-title:first')
                .attr('title', sourceEl.options.title)
                .text(sourceEl.options.title);
            if (this.options.menu.length === 0) {
                $li.find('.layer-menu-btn').remove();
            }
            var $childList = $('ul.layers', $li);
            if (sourceEl.children) {
                $childList.attr('id', 'list-' + sourceEl.options.id);
                if (config.toggle) {
                    $childList.addClass("closed");
                }
                for (var j = sourceEl.children.length - 1; j >= 0; j--) {
                    $childList.append(this._createLayerNode(source, sourceEl.children[j]));
                }
            } else {
                $childList.remove();
            }

            return $li;
        },
        _createSourceTree: function(source) {
            var li = this._createLayerNode(source, source.configuration.children[0]);
            if (source.configuration.status !== 'ok') {
                li.attr('data-state', 'error').find('span.layer-title:first').attr("title",
                    source.configuration.status);
            }
            return li;
        },
        _onSourceAdded: function(event, options) {
            if (!this.created || !options.added)
                return;
            var added = options.added;
            if (added.source.configuration.baseSource && !this.options.showBaseSource) {
                return;
            }
            var li_s = this._createSourceTree(added.source);
            var first_li = $(this.element).find('ul.layers:first li:first');
            if (first_li && first_li.length !== 0) {
                first_li.before(li_s);
            } else {
                $(this.element).find('ul.layers:first').append($(li_s));
            }
            this._reset();
        },
        _onSourceChanged: function(event, data) {
            this._resetSourceAtTree(data.source);
        },
        _onSourceLayerRemoved: function(event, data) {
            var layerId = data.layerId;
            var sourceId = data.source.id;
            var $node = $('[data-sourceid="' + sourceId + '"][data-id="' + layerId + '"]', this.element);
            $node.remove();
        },
        _isThemeChecked: function($li) {
            var $themeNode = $li.closest('li.themeContainer', this.element);
            if (!this.options.useTheme || !$themeNode.length) {
                return true;
            }
            var $sourceVisCheckbox = $('>.leaveContainer input[name="sourceVisibility"]', $themeNode);
            if ($sourceVisCheckbox.length) {
                return $sourceVisCheckbox.prop('checked');
            } else {
                return true;
            }
        },
        _redisplayLayerState: function($li, state) {
            if (state.outOfScale) {
                $li.addClass("invisible").find('span.layer-state').attr("title", "out of scale");
            } else if (state.visibility) {
                $li.removeClass("invisible").find('span.layer-state:first').attr("title", "");
            } else {
                // @todo (TBD): is this really a separate state, or is visibility always := !outOfScale?
                $li.addClass("invisible").find('span.layer-state').attr("title", "");
            }
        },
        _resetSourceAtTree: function(source) {
            var self = this;
            function resetLayer(layer) {
                var $li = $('li[data-id="' + layer.options.id + '"]', self.element);
                self._updateLayerDisplay($li, layer);
                if (layer.children) {
                    for (var i = 0; i < layer.children.length; i++) {
                        resetLayer(layer.children[i]);
                    }
                }
            }
            resetLayer(source.configuration.children[0]);
        },
        _updateLayerDisplay: function($li, layer) {
            if (layer && layer.state && Object.keys(layer.state).length) {
                this._redisplayLayerState($li, layer.state);
            }
            if (layer && Object.keys((layer.options || {}).treeOptions).length) {
                var $checkboxScope = $('>.leaveContainer', $li);
                this._updateLayerCheckboxes($checkboxScope, layer.options.treeOptions);
            }
        },
        _updateLayerCheckboxes: function($scope, treeOptions) {
            var allow = treeOptions.allow || {};
            var $selectedChk = $('input[name="selected"]:first', $scope);
            var $infoChk = $('input[name="info"]:first', $scope);
            if (treeOptions.selected !== null && typeof treeOptions.selected !== 'undefined') {
                $selectedChk.prop('checked', !!treeOptions.selected);
            }
            if (allow.selected !== null && typeof allow.selected !== 'undefined') {
                $selectedChk.prop('disabled', !allow.selected);
            }
            if (treeOptions.info !== null && typeof treeOptions.info !== 'undefined') {
                $infoChk.prop('checked', !!treeOptions.info);
            }
            if (allow.info !== null && typeof allow.info !== 'undefined') {
                $infoChk.prop('disabled', !allow.info);
            }
            $('input[type="checkbox"]', $scope).mbCheckbox();
        },
        _onSourceRemoved: function(event, removed) {
            if (removed && removed.source && removed.source.id) {
                var $source = $('ul.layers:first li[data-sourceid="' + removed.source.id + '"]', this.element);
                var $theme = $source.parents('.themeContainer:first');
                $('ul.layers:first li[data-sourceid="' + removed.source.id + '"]', this.element).remove();
                if ($theme.length && $theme.find('.serviceContainer').length === 0){
                    $theme.remove();
                }
                this._setSourcesCount();
            }
        },
        _getSourceNode: function(sourceId) {
            return $('li[data-sourceid="' + sourceId + '"][data-type="root"]', this.element);
        },
        _onSourceLoadStart: function(event, options) {
            var sourceId = options.source && options.source.id;
            var $sourceEl = sourceId && this._getSourceNode(sourceId);
            if ($sourceEl && $sourceEl.length) {
                this.loadStarted[sourceId] = true;
                $sourceEl.attr('data-state', 'loading');
            }
        },
        _onSourceLoadEnd: function(event, options) {
            var sourceId = options.source && options.source.id;
            var $sourceEl = sourceId && this._getSourceNode(sourceId);
            if ($sourceEl && $sourceEl.length && this.loadStarted[sourceId]) {
                this.loadStarted[sourceId] = false;
                $sourceEl.attr('data-state', '');
                this._resetSourceAtTree(options.source);
            }
        },
        _onSourceLoadError: function(event, options) {
            var sourceId = options.source && options.source.id;
            var $sourceEl = sourceId && this._getSourceNode(sourceId);
            if ($sourceEl && $sourceEl.length && this.loadStarted[sourceId]) {
                this.loadStarted[sourceId] = false;
                $sourceEl.attr('data-state', 'error');
            }
        },
        _getNodeType: function(node, isroot) {
            if (isroot) {
                return this.consts.root;
            } else if (node.children) {
                return this.consts.group;
            } else {
                return this.consts.simple;
            }
        },
        _getNodeProporties: function(nodeConfig) {
            var conf = {
                selected: nodeConfig.options.treeOptions.selected,
                selectable: nodeConfig.options.treeOptions.allow.selected,
                info: nodeConfig.options.treeOptions.info,
                reorderable: nodeConfig.options.treeOptions.allow.reorder
            };

            if (nodeConfig.children) {
                conf["toggle"] = nodeConfig.options.treeOptions.toggle;
                conf["toggleable"] = nodeConfig.options.treeOptions.allow.toggle;
            } else {
                conf["toggle"] = null;
                conf["toggleable"] = null;
            }

            if (nodeConfig.state.outOfScale) {
                conf["visibility"] = {
                    state: "invisible",
                    tooltip: this.transConst.outOfScale
                };
            } else if (nodeConfig.state.outOfBounds) {
                conf["visibility"] = {
                    state: "invisible",
                    tooltip: this.transConst.outOfBounds
                };
            } else if (!nodeConfig.state.visibility) {
                conf["visibility"] = {
                    state: "invisible",
                    tooltip: this.transConst.parentinvisible
                };
            } else {
                conf["visibility"] = {
                    state: "",
                    tooltip: ""
                };
            }
            return conf;
        },
        _toggleContent: function(e) {
            var $me = $(e.target);
            var $parent = $me.parents('li:first');
            if (!$parent.hasClass('toggleable'))
                return false;
            if ($me.hasClass("iconFolderActive")) {
                $me.removeClass("iconFolderActive");
                $parent.removeClass("showLeaves");
            } else {
                $me.addClass("iconFolderActive");
                $parent.addClass("showLeaves");
            }
            var li = $me.closest('li.leave');
            var layer = li.data('layer');
            if (layer) {
                this._resetSourceAtTree(layer.source);
            }
            return false;
        },
        _toggleSourceVisibility: function(e) {
            var self = this;
            var $sourceVsbl = $(e.target);
            var $li = $sourceVsbl.parents('li:first');
            $('li[data-type="' + this.consts.root + '"]', $li).each(function(idx, item) {
                var $item = $(item);
                var $chkSource = $('input[name="selected"]:first', $item);
                var active = $chkSource.prop('checked') && $sourceVsbl.prop('checked');
                self.model.setSourceVisibility($item.attr('data-sourceid'), active);
            });
            if (this._mobilePane) {
                $('#mobilePaneClose', this._mobilePane).click();
            }
            return false;
        },
        _selectAll: function(e) {
            var self = this;
            var $sourceVsbl = $(e.target);
            var $li = $sourceVsbl.parents('li:first');
            $('li[data-type="' + this.consts.root + '"]', $li).each(function(idx, srcLi) {
                var $srcLi = $(srcLi);
                var sourceId = $srcLi.attr('data-sourceid');
                var source = sourceId && self.model.getSourceById(sourceId);
                if (source) {
                    Mapbender.Util.SourceTree.iterateLayers(source, false, function(layer) {
                        layer.options.treeOptions.selected = layer.options.treeOptions.allow.selected;
                    });
                    self.model.updateSource(source);
                }
            });
            return false;
        },
        _toggleSelected: function(e) {
            var $target = $(e.target);
            var layer = $target.closest('li.leave').data('layer');
            var source = layer && layer.source;
            if (layer.parent) {
                this.model.controlLayer(source, layer.options.id, $(e.target).prop('checked'));
            } else {
                if (this._isThemeChecked($target)) {
                    this.model.setSourceVisibility(source, $(e.target).prop('checked'));
                }
            }
            if (this._mobilePane) {
                $('#mobilePaneClose', this._mobilePane).click();
            }
            return false;
        },
        _toggleInfo: function(e) {
            var layer = $(e.target).closest('li.leave').data('layer');
            this.model.controlLayer(layer.source, layer.options.id, null, $(e.target).prop('checked'));
        },
        currentMenu: null,
        closeMenu: function(menu) {
            var $menu = menu || this.currentMenu;
            $menu.remove();
            this.currentMenu = null;
            return false;
        },
        _initMenu: function($layerNode) {
            var layer = $layerNode.data('layer');
            var source = layer.source;
            var atLeastOne;
            var menu = $(this.menuTemplate.clone())
                .attr("data-menuLayerId", layer.options.id)
                .attr("data-menuSourceId", layer.source.id)
            ;
            var removeButton = menu.find('.layer-remove-btn');
            menu.on('mousedown mousemove', function(e) {
                e.stopPropagation();
            });
            atLeastOne = removeButton.length > 0;
            removeButton.on('click', $.proxy(this._removeSource, this));

            // element must be added to dom and sized before Dragdealer init...
            menu.removeClass('hidden');
            $('.leaveContainer:first', $layerNode).after(menu);

            var $opacitySliderWrap = $('#layer-opacity', menu);
            if (layer.getParent()) {
                $opacitySliderWrap.remove();
                menu.find('#layer-opacity-title').remove();
            } else if ($.inArray("opacity", this.options.menu) !== -1 && $opacitySliderWrap.length) {
                atLeastOne = true;
                var self = this;
                var $handle = $('.layer-opacity-handle', menu);
                $handle.attr('unselectable', 'on');
                new Dragdealer($opacitySliderWrap.get(0), {
                    x: source.configuration.options.opacity,
                    horizontal: true,
                    vertical: false,
                    speed: 1,
                    steps: 100,
                    handleClass: "layer-opacity-handle",
                    animationCallback: function(x, y) {
                        var percentage = Math.round(x * 100);
                        $handle.text(percentage);
                        self._setOpacity(source, percentage / 100.0);
                    }
                });
            }
            if ($.inArray("zoomtolayer", this.options.menu) !== -1 && menu.find('.layer-zoom').length > 0
                && this.model.getLayerExtents({
                    sourceId: source.id,
                    layerId: layer.options.id
                })) {
                atLeastOne = true;
                $('.layer-zoom', menu).removeClass('inactive').on('click', $.proxy(this._zoomToLayer, this));
            } else {
                $('.layer-zoom', menu).remove();
            }
            if (this.options.menu.indexOf('metadata') !== -1 && source.supportsMetadata() && $('.layer-metadata', menu).length) {
                atLeastOne = true;
                $('.layer-metadata', menu).removeClass('inactive').on('click', $.proxy(this._showMetadata, this));
            } else {
                $('.layer-metadata', menu).remove();
            }
            var dims = source.configuration.options.dimensions ? source.configuration.options.dimensions : [];
            if ($.inArray("dimension", this.options.menu) !== -1 && source.type === 'wms'
                && source.configuration.children[0].options.id === layer.options.id && dims.length) {
                this._initDimensionsMenu($layerNode, menu, dims, source);
                atLeastOne = true;
            } else {
                $('.layer-dimension-checkbox', menu).remove();
                $('.layer-dimension-title', menu).remove();
                $('.layer-dimension-bar', menu).remove();
                $('.layer-dimension-textfield', menu).remove();
            }

            if (atLeastOne) {
                menu.removeClass('hidden');
                return menu;
            } else {
                return null;
            }

        },
        _toggleMenu: function(e) {
            var self = this;
            var $btnMenu = $(e.target);
            var $layerNode = $btnMenu.closest('li.leave');
            var layer = $layerNode.data('layer');
            var currentLayerId = layer.options.id;
            var layerIdMenu = null;
            var $menu = this.currentMenu || $('.layer-menu', this.element);
            if ($menu.length) {
                layerIdMenu = $menu.attr("data-menuLayerId");
            }
            if (layerIdMenu !== currentLayerId) {
                if ($menu.length) {
                    this.closeMenu($menu);
                }
                this.currentMenu = this._initMenu($layerNode);
                $('.exit-button', this.currentMenu).on('click', function(e) {
                    self.closeMenu(self.currentMenu);
                });
            }
            return false;
        },
        _initDimensionsMenu: function($element, menu, dims, source) {
            var self = this;
            var lastItem = $('.layer-dimension-checkbox', menu).prev();
            var dimCheckbox = $('.layer-dimension-checkbox', menu).remove();
            var dimTitle = $('.layer-dimension-title', menu).remove();
            var dimBar = $('.layer-dimension-bar', menu).remove();
            var dimTextfield = $('.layer-dimension-textfield', menu).remove();
            $.each(dims, function(idx, item) {
                var dimData = $element.data('dimensions') || {};
                var dimDataKey = source.id + '~' + idx;
                dimData[dimDataKey] = dimData[dimDataKey] || {
                    checked: false
                };
                var updateData = function(props) {
                    $.extend(dimData[dimDataKey], props);
                    var ourData = {};
                    ourData[dimDataKey] = dimData[dimDataKey];
                    var mergedData = $.extend($element.data('dimensions') || {}, ourData);
                    $element.data('dimensions', mergedData);
                };
                var chkbox = dimCheckbox.clone();
                var title = dimTitle.clone();
                lastItem.after(chkbox);
                var inpchkbox = chkbox.find('.checkbox');
                inpchkbox.data('dimension', item);
                inpchkbox.prop('checked', dimData[dimDataKey].checked);
                inpchkbox.on('change', function(e) {
                    updateData({checked: $(this).prop('checked')});
                    self._callDimension(source, $(e.target));
                });
                inpchkbox.mbCheckbox();
                title.attr('title', title.attr('title') + ' ' + item.name);
                title.attr('id', title.attr('id') + item.name);
                chkbox.after(title);
                if (item.type === 'single') {
                    var textf = dimTextfield.clone();
                    title.after(textf);
                    textf.val(item.extent);
                    inpchkbox.attr('data-value', dimData.value || item.extent);
                    updateData({value: dimData.value || item.extent});
                    lastItem = textf;
                } else if (item.type === 'multiple' || item.type === 'interval') {
                    var bar = dimBar.clone();
                    title.after(bar);
                    bar.removeClass('layer-dimension-bar');
                    bar.attr('id', bar.attr('id') + item.name);
                    bar.find('.layer-dimension-handle').removeClass('layer-dimension-handle').
                        addClass('layer-dimension-' + item.name + '-handle').attr('unselectable', 'on');
                    lastItem = bar;
                    var dimHandler = Mapbender.Dimension(item);
                    var label = $('#layer-dimension-value-' + item.name, menu);
                    new Dragdealer('layer-dimension-' + item.name, {
                        x: dimHandler.partFromValue(dimData[dimDataKey].value || dimHandler.getDefault()),
                        horizontal: true,
                        vertical: false,
                        speed: 1,
                        steps: dimHandler.getStepsNum(),
                        handleClass: 'layer-dimension-' + item.name + '-handle',
                        callback: function(x, y) {
                            self._callDimension(source, inpchkbox);
                        },
                        animationCallback: function(x, y) {
                            var value = dimHandler.valueFromPart(x);
                            label.text(value);
                            updateData({value: value});
                            inpchkbox.attr('data-value', value);
                        }
                    });
                } else {
                    Mapbender.error("Source dimension " + item.type + " is not supported.");
                }
            });
        },
        _callDimension: function(source, chkbox) {
            var dimension = chkbox.data('dimension');
            var paramName = dimension['__name'];
            if (chkbox.is(':checked') && paramName) {
                var params = {};
                params[paramName] = chkbox.attr('data-value');
                source.addParams(params);
            } else if (paramName) {
                source.removeParams([paramName]);
            }
            return true;
        },
        _setOpacity: function(source, opacity) {
            this.model.setOpacity(source, opacity);
        },
        _removeSource: function(e) {
            var $node = $(e.currentTarget).closest('li.leave');
            var layerId = $node.attr('data-id');
            var sourceId = $node.attr('data-sourceid');
            if (layerId && sourceId) {
                this.model.removeLayer(sourceId, layerId);
                this._setSourcesCount();
            }
        },
        _zoomToLayer: function(e) {
            var options = {
                sourceId: $(e.target).parents('div.layer-menu:first').attr("data-menuSourceId"),
                layerId: $(e.target).parents('div.layer-menu:first').attr("data-menuLayerId")
            };
            this.model.zoomToLayer(options);
        },
        _showMetadata: function(e) {
            var layer = $(e.target).closest('li.leave', this.element).data('layer');
            Mapbender.Metadata.call(null, null, layer);
        },
        _getUniqueSourceIds: function() {
            var sourceIds = [];
            $('.serviceContainer[data-sourceid]', this.element).each(function() {
                sourceIds.push($(this).attr('data-sourceid'));
            });
            return _.uniq(sourceIds);
        },
        _setSourcesCount: function() {
            var num = this._getUniqueSourceIds().length;
            $(this.element).find('#counter').text(num);
        },
        _removeAllSources: function(e) {
            var sourceIds, i, n;
            if (Mapbender.confirm(Mapbender.trans("mb.core.layertree.confirm.allremove"))) {
                sourceIds = this._getUniqueSourceIds();
                for (i = 0, n = sourceIds.length; i < n; ++i) {
                    this.model.removeSourceById(sourceIds[i]);
                }
            }
            this._setSourcesCount();
        },
        /**
         * Default action for mapbender element
         */
        defaultAction: function(callback) {
            this.open(callback);
        },
        /**
         * Opens a dialog with a layertree (if options.type == 'dialog')
         */
        open: function(callback) {
            this.callback = callback ? callback : null;
            if (this.options.type === 'dialog') {
                var self = this;
                if (!this.popup || !this.popup.$element) {
                    this._createTree();
                    this.popup = new Mapbender.Popup2({
                        title: self.element.attr('data-title'),
                        modal: false,
                        resizable: true,
                        draggable: true,
                        closeOnESC: false,
                        content: [self.element.show()],
                        destroyOnClose: true,
                        width: 350,
                        height: 500,
                        cssClass: 'customLayertree',
                        buttons: {
                            'ok': {
                                label: Mapbender.trans("mb.core.layertree.popup.btn.ok"),
                                cssClass: 'button right',
                                callback: function() {
                                    self.close();
                                }
                            }
                        }
                    });
                    this._reset();
                    this.popup.$element.on('close', $.proxy(this.close, this));
                } else {
                    this._reset();
                    this.popup.open();
                }
            }
        },
        /**
         * closes a dialog with a layertree (if options.type == 'dialog')
         */
        close: function() {
            if (this.options.type === 'dialog') {
                if (this.popup) {
                    $("ul.layers:first", this.element).empty();
                    $(this.element).hide().appendTo("body");
                    this._unSortable();
                    this.created = false;
                    if (this.popup.$element) {
                        this.popup.destroy();
                    }
                    this.popup = null;
                }
            }
            this.callback ? this.callback.call() : this.callback = null;
        },
        _findLayersetWithSource: function(source) {
            var layerset = null;
            Mapbender.Util.SourceTree.iterateLayersets(function(layersetDef, layersetId) {
                for (var i = 0; i < layersetDef.length; i++) {
                    if (layersetDef[i][source.origId]) {
                        layerset = {
                            id: layersetId,
                            title: Mapbender.configuration.layersetmap[layersetId],
                            content: layersetDef
                        };
                        // stop iteration
                        return false;
                    }
                }
            });
            return layerset;
        },
        _destroy: $.noop
    });

})(jQuery);
