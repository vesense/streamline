define(['require', 'utils/Globals', 'utils/Utils', 'modules/TopologyGraphCreator', 'x-editable', ], function(require, Globals, Utils, TopologyGraphCreator, xEditable) {
    'use strict';
    var TopologyUtils = {};

    TopologyUtils.verifyLink = function(linkArr, uiname) {
        var obj = linkArr.filter(function(obj) {
            return (obj.target.uiname === uiname);
        });
        if (!obj.length) {
            Utils.notifyError('Connect the node to configure.');
            return false;
        }
        return true;
    };

    TopologyUtils.generateFormulaPreview = function(models, arrayFlag) {
        var rulePreview, html = '';
        for (var i = 0; i < models.length; i++) {
            var rule = models[i].get('config');
            rulePreview = '';
            for (var j = 0; j < rule.length; j++) {
                var firstOp, op, secondOp, logicalOp;
                if (arrayFlag) {
                    firstOp = rule[j].firstOperand.name;
                    op = rule[j].operation;
                    secondOp = rule[j].secondOperand;
                    logicalOp = (j === 0 ? '' : rule[j - 1].logicalOperator);
                } else {
                    firstOp = rule[j].get('firstOperand');
                    op = rule[j].get('operation');
                    secondOp = rule[j].get('secondOperand');
                    logicalOp = rule[j].get('logicalOperator');
                }
                if (j === 0)
                    rulePreview += firstOp + ' ' + op + ' ' + secondOp;
                else {
                    rulePreview += ' ' + logicalOp + ' ' + firstOp + ' ' + op + ' ' + secondOp;
                }
            }

            var badgeTxt = '';
            _.each(models[i].get('ruleConnectsTo'), function(o) {
                badgeTxt += ' <span class="badge">' + o.name + '</span>';
            });

            html += '<li data-id="' + models[i].get('ruleId') +
                '" class="check-rule list-group-item"><div class="row"><div class="col-sm-11"><b>' + models[i].get('ruleName') +
                ':  </b>' + rulePreview + badgeTxt + '</div>';

            if (arrayFlag) {
                html += '<div class="btn-group btn-group-sm col-sm-1"><i class="fa fa-check"></i></div></div></li>';
            } else {
                html += '<div class="btn-group btn-group-sm col-sm-1"><button ' +
                    'data-id="' + models[i].get('ruleId') + '" title="Edit" class="btn-action btn-primary ruleAction" id="editRule" type="default"><i class="fa fa-pencil"></i></button><button ' +
                    'data-id="' + models[i].get('ruleId') + '" title="Delete" class="btn-action btn-danger" id="deleteRule" type="default"><i class="fa fa-trash"></i></button></div></div></li>';
            }
        }

        return html;
    };

    TopologyUtils.generateName = function(name, nameList) {
        var count = 1,
            newName = name;
        while (nameList.indexOf(newName) !== -1) {
            newName = newName + '-' + count;
            count++;
        }
        nameList.push(newName);
        return newName;
    };

    TopologyUtils.configSortComparator = function(a, b) {
        if (a.isOptional < b.isOptional)
            return -1;
        if (a.isOptional > b.isOptional)
            return 1;
        return 0;
    };

    TopologyUtils.setAdditionalData = function(sourceObj, newData) {
        for (var key in newData) {
            sourceObj[key] = newData[key];
        }
        return sourceObj;
    };

    TopologyUtils.setHiddenConfigFields = function(model, obj) {
        if (obj) {
            var configFields = JSON.parse(obj.config);
            var hiddenFields = {
                type: obj.subType,
                transformationClass: obj.transformationClass
            };
            model.set('hiddenFields', hiddenFields);
            model.set('config', configFields);
        }
        return model;
    };

    TopologyUtils.updateVariables = function(configArr, topLevelConfigArr, nameList, nodeArr, graphArr, globalObj, currentType, subType) {
        var self = this;
        _.each(configArr, function(obj) {
            nameList.push(obj.uiname);
            var model = new Backbone.Model({ firstTime: false, currentType: (currentType ? currentType : obj.type), uiname: obj.uiname });
            model = TopologyUtils.setHiddenConfigFields(model, _.findWhere(topLevelConfigArr, { subType: (subType ? subType : obj.type) }));
            model.attributes = TopologyUtils.setAdditionalData(model.attributes, obj.config);
            if (currentType && currentType === 'DEVICE') {
                model.set('_selectedTable', [{ dataSourceId: model.get('dataSourceId') }]);
            }
            nodeArr.push(model.toJSON());
            var t_obj = _.findWhere(globalObj, { valStr: model.get('currentType') });
            graphArr.push(_.extend(JSON.parse(JSON.stringify(t_obj)), { uiname: obj.uiname, currentType: model.get('currentType'), isConfigured: true }));
        });
    };

    TopologyUtils.setTopologyName = function(elem, callback) {
        elem.editable({
            mode: 'inline',
            validate: function(value) {
                if (_.isEqual($.trim(value), '')) return 'Name is required';
            }
        });

        elem.on('save', callback);

        elem.on('rendered', function(e) {
            $(e.currentTarget).append("<i class='fa fa-pencil'></i>");
        });
    };

    TopologyUtils.bindDrag = function(elem) {
        elem.draggable({
            revert: "invalid",
            helper: function(e) {
                return $(e.currentTarget).clone();
            }
        });
    };

    TopologyUtils.bindDrop = function(elem, dsArr, processorArr, sinkArr, vent, nodeNamesList) {
        elem.droppable({
            drop: function(event, ui) {
                var parentType = ui.helper.data().parenttype,
                    subType = ui.helper.data().subtype,
                    obj = _.findWhere(Globals.Topology.Editor.Steps[parentType].Substeps, { valStr: subType }),
                    uiname = TopologyUtils.generateName(subType, nodeNamesList);
                switch (parentType) {
                    case Globals.Topology.Editor.Steps.Datasource.valStr:
                        dsArr.push({ uiname: uiname, firstTime: true, currentType: subType });
                        var parserName = uiname.replace('DEVICE', 'PARSER');
                        nodeNamesList.push(parserName);
                        processorArr.push({ uiname: parserName, firstTime: true, currentType: 'PARSER' });
                        break;

                    case Globals.Topology.Editor.Steps.Processor.valStr:
                        processorArr.push({ uiname: uiname, firstTime: true, currentType: subType });
                        break;

                    case Globals.Topology.Editor.Steps.DataSink.valStr:
                        sinkArr.push({ uiname: uiname, firstTime: true, currentType: subType });
                        break;
                }

                vent.trigger('topologyEditor:DropAction', {
                    nodeObj: obj,
                    uiname: uiname,
                    event: event
                });
            }
        });
    };

    TopologyUtils.getNode = function(parent, nodeArr, uiname, callback, topLevelConfig, verifyLink, subType, linkArr) {
        var model = new Backbone.Model();
        var modelObj = nodeArr[_.findIndex(nodeArr, { uiname: uiname })];
        model.set(modelObj);
        if (modelObj.firstTime) {
            TopologyUtils.setHiddenConfigFields(model, _.findWhere(topLevelConfig, { subType: subType }));
        }
        if (verifyLink) {
            if (TopologyUtils.verifyLink(linkArr, model.get('uiname'))) {
                callback.call(parent, model, subType);
            }
        } else {
            callback.call(parent, model);
        }
    };

    TopologyUtils.saveNode = function(nodeArr, newData, parent) {
    	if(parent.titleName !== newData.get('uiname')){
    		parent.nodeNames[parent.nodeNames.indexOf(parent.titleName)] = newData.get('uiname');
        	TopologyUtils.updateUiName(newData.get('currentType'), parent.titleName, newData.get('uiname'), parent);
    	}

        var i = _.findIndex(nodeArr, { uiname: newData.get('uiname') });
        nodeArr[i] = newData.toJSON();
        if(nodeArr[i].currentType === 'NOTIFICATION' || nodeArr[i].currentType === 'HDFS' || nodeArr[i].currentType === 'HBASE'){
        	var obj = parent.linkArr.filter(function(obj){
        		return (obj.target.uiname === nodeArr[i].uiname);
        	});
        	if(obj.length){
        		_.each(obj, function(o){
        			if(o.source.currentType === 'RULE'){
        				var index = _.findIndex(parent.processorArr, {uiname: o.source.uiname});
        				var ruleProcessor = parent.processorArr[index];
        				var ruleObj = ruleProcessor.newConfig ? ruleProcessor.newConfig.rulesProcessorConfig.rules : ruleProcessor.rulesProcessorConfig.rules;
        				_.each(ruleObj, function(r){
        					var ruleIndex = _.findIndex(r.actions, {name: newData.get('uiname')});
                            if(ruleIndex !== -1){
                                if(nodeArr[i].currentType === 'NOTIFICATION'){
                                    r.actions[ruleIndex].outputFieldsAndDefaults = newData.get('fieldValues');
                                    r.actions[ruleIndex].includeMeta = true;
                                    r.actions[ruleIndex].notifierName = newData.get('notifierName');
                                }
                            } else {
                                Utils.notifyInfo("No rules is associated with "+newData.get('uiname'));
                            }
        				});
        			}
        		});
        	}
        } else if(nodeArr[i].currentType === 'RULE'){
        	var sinkObjs = _.where(parent.sinkArr, {currentType: 'NOTIFICATION'}), arr = [];
        	_.each(sinkObjs, function(o){
        		arr.push(o.uiname);
        	});
        	if(arr.length){
        		var ruleObj = nodeArr[i].newConfig ? nodeArr[i].newConfig.rulesProcessorConfig.rules : nodeArr[i].rulesProcessorConfig.rules;
				_.each(ruleObj, function(r){
					_.each(r.actions, function(o){
						if(arr.indexOf(o.name) !== -1){
							if(!o.notifierName){
								var notiSink = parent.sinkArr[_.findIndex(parent.sinkArr, {uiname: o.name})];
								if(notiSink){
									o.outputFieldsAndDefaults = notiSink.fieldValues;
				                    o.includeMeta = true;
				                    o.notifierName = notiSink.notifierName;
								}
							}
						}
					});
				});
        	}
        }
        parent.vent.trigger('saveNodeConfig', { uiname: newData.get("uiname") });
    };

    TopologyUtils.syncGraph = function(editFlag, graphNodeData, linkArr, graphElem, vent, graphTransforms) {
        var self = this;
        var nodes = [],
            edges = [];
        if (editFlag) {
            Array.prototype.push.apply(nodes, graphNodeData.source);
            Array.prototype.push.apply(nodes, graphNodeData.processor);
            Array.prototype.push.apply(nodes, graphNodeData.sink);

            var newLinkArr = [];
            _.each(linkArr, function(obj) {
                newLinkArr.push(obj.source);
                newLinkArr.push(obj.target);
            });

            var newArr = [];
            _.each(nodes, function(object, i) {
                var nodeObj = _.findWhere(newLinkArr, { uniqueName: object.currentType + '-' + object.nodeId });
                if (!nodeObj) {
                    nodeObj = _.findWhere(newLinkArr, { uiname: object.uiname });
                }
                newArr.push({
                    x: _.isUndefined(nodeObj) ? -800 : nodeObj.x,
                    y: _.isUndefined(nodeObj) ? -300 : nodeObj.y,
                    uiname: nodeObj.uniqueName ? nodeObj.uniqueName : nodeObj.uiname,
                    parentType: nodeObj.parentType,
                    currentType: nodeObj.currentType,
                    imageURL: nodeObj.imageURL,
                    id: nodeObj.id,
                    streamId: _.isUndefined(nodeObj.streamId) ? undefined : nodeObj.streamId,
                    isConfigured: object.isConfigured
                });
            });
            nodes = newArr;

            _.each(linkArr, function(obj) {
                obj.source = _.findWhere(newArr, { uiname: obj.source.uiname });
                obj.target = _.findWhere(newArr, { uiname: obj.target.uiname });
            });

            edges = linkArr;
        }
        var graphData = { nodes: nodes, edges: edges, graphTransforms: graphTransforms};
        var topologyGraph = new TopologyGraphCreator({
            elem: graphElem,
            data: graphData,
            vent: vent
        });
        topologyGraph.updateGraph();
        return topologyGraph;
    };

    TopologyUtils.syncParserData = function(model, linkArr, dsArr) {
        var obj = linkArr.filter(function(obj) {
            return (obj.target.currentType === 'PARSER' && obj.target.uiname === model.get('uiname'));
        });
        if (obj.length) {
            var sourceData = dsArr.filter(function(o) {
                return o.uiname === obj[0].source.uiname;
            });
            if (!sourceData.length) {
                Utils.notifyError("Configure the connected source node first.");
                return false;
            } else {
                if (!model.has('_dataSourceId')) model.set('_dataSourceId', (sourceData[0].dataSourceId ? sourceData[0].dataSourceId : sourceData[0]._selectedTable[0].datasourceId));
                if (!model.has('parallelism')) {
                    model.set('parallelism', 1);
                }
                return true;
            }
        }
    };

    TopologyUtils.syncRuleData = function(model, linkArr, processorArr, dsArr) {
        var obj = linkArr.filter(function(obj) {
            return (obj.target.currentType === 'RULE' && obj.target.uiname === model.get('uiname'));
        });
        if (obj.length) {
            var sourceData = processorArr.filter(function(o) {
                return o.uiname === obj[0].source.uiname;
            });
            if (!sourceData.length) {
                Utils.notifyError("Configure the connected node first.");
                return false;
            } else {
                var sourceParserNode = linkArr.filter(function(o) {
                    return (o.target.currentType === 'PARSER' && o.target.uiname === obj[0].source.uiname);
                });
                //Get dsId from datasource
                var sourceObj = dsArr.filter(function(o) {
                    return o.uiname === sourceParserNode[0].source.uiname;
                });

                var dsId = sourceObj[0]._selectedTable[0];
                model.set('dataSourceId', (dsId.dataSourceId ? dsId.dataSourceId : dsId.datasourceId));
                if (model.has('rulesProcessorConfig')) {
                    var object = {
                        "rulesProcessorConfig": model.get('rulesProcessorConfig')
                    };
                    if (!model.has('newConfig')) model.set('newConfig', object);
                }
                return true;
            }
        }
    };

    TopologyUtils.syncSinkData = function(model, linkArr, processorArr) {
        var obj = linkArr.filter(function(obj) {
            return (obj.target.parentType === 'DataSink' && obj.target.uiname === model.get('uiname'));
        });
        var flag = true;
        if (obj.length) {
            _.each(obj, function(o) {
                if (flag && o.source.parentType === 'Processor') {
                    var sourceData = processorArr.filter(function(o) {
                        return o.uiname === obj[0].source.uiname;
                    });
                    if (!sourceData.length) {
                        flag = false;
                    }
                }
            });
            return flag;
        }
    };

    TopologyUtils.generateJSONForDataSource = function(dsArr) {
        var ds = [],msg,
            flag = true;
        _.each(dsArr, function(obj) {
            if (!obj.firstTime) {
                var configObj = {};
                _.each(obj.config, function(o) {
                    if (obj[o.name]) {
                        configObj[o.name] = obj[o.name];
                    }
                });
                configObj.dataSourceId = (obj._selectedTable[0].datasourceId ? obj._selectedTable[0].datasourceId : obj._selectedTable[0].dataSourceId);
                ds.push({
                    "uiname": obj.uiname,
                    "type": obj.hiddenFields ? obj.hiddenFields.type : '',
                    "transformationClass": obj.hiddenFields ? obj.hiddenFields.transformationClass : '',
                    "config": configObj
                });
            } else {
                flag = false;
                msg = obj.uiname+' is not configured yet. Kindly configure to proceed.';
            }
        });
        return { flag: flag, ds: ds, msg: msg};
    };

    TopologyUtils.generateJSONForProcessor = function(processorArr, linkArr) {
        var processors = [], msg,
            flag = true;
        _.each(processorArr, function(obj) {
            if (!obj.firstTime) {
                if(linkArr.filter(function(o){ return o.target.uiname === obj.uiname;}).length){
                    if (obj.hiddenFields.type === 'PARSER') {
                        var config = {
                            "parsedTuplesStream": "parsedTuplesStream",
                            "failedTuplesStream": "failedTuplesStream",
                            "parallelism": obj.parallelism
                        };
                        if (obj.dataSourceId) config.dataSourceId = obj.dataSourceId;
                        if (obj.parserId) config.parserId = obj.parserId;
                        processors.push({
                            "uiname": obj.uiname,
                            "type": obj.hiddenFields ? obj.hiddenFields.type : '',
                            "transformationClass": obj.hiddenFields ? obj.hiddenFields.transformationClass : '',
                            "config": config
                        });
                    } else if (obj.hiddenFields.type === 'RULE') {

                        processors.push({
                            "uiname": obj.uiname,
                            "type": obj.hiddenFields ? obj.hiddenFields.type : '',
                            "transformationClass": obj.hiddenFields ? obj.hiddenFields.transformationClass : '',
                            "config": obj.newConfig ? obj.newConfig : { parallelism: obj.parallelism, rulesProcessorConfig: obj.rulesProcessorConfig }
                        });
                    }
                } else {
                    flag = false;
                    msg = "Connect "+obj.uiname+" before saving";
                }
            } else {
                flag = false;
                msg = obj.uiname+' is not configured yet. Kindly configure to proceed.';
            }
        });
        return { flag: flag, processors: processors, msg: msg };
    };

    TopologyUtils.generateJSONForSink = function(sinkArr, linkArr) {
        var sink = [], flag = true, msg;
        _.each(sinkArr, function(obj) {
            if (!obj.firstTime) {
                if(linkArr.filter(function(o){ return o.target.uiname === obj.uiname;}).length){
                    var configObj = {};
                    _.each(obj.config, function(o) {
                        if (obj[o.name]) {
                            configObj[o.name] = obj[o.name];
                        }
                    });
                    sink.push({
                        "uiname": obj.uiname,
                        "type": obj.hiddenFields ? obj.hiddenFields.type : '',
                        "transformationClass": obj.hiddenFields ? obj.hiddenFields.transformationClass : '',
                        "config": configObj
                    });
                } else {
                    flag = false;
                    msg = "Connect "+obj.uiname+" before saving";
                }
            } else {
            	flag = false;
                msg = obj.uiname+' is not configured yet. Kindly configure to proceed.';
            }
        });
        return {flag: flag, sink: sink, msg: msg};
    };

    TopologyUtils.updateUiName = function(currentType, oldName, newName, parent){
    	var self = this, index;
    	switch(currentType){
    		case 'DEVICE':
    			index = _.findIndex(parent.dsArr, {uiname: oldName});
    			if(index !== -1){
    				parent.dsArr[index].uiname = newName;
    			}
    			break;
    		case 'PARSER':
    		case 'RULE':
    			index = _.findIndex(parent.processorArr, {uiname: oldName});
    			if(index !== -1){
    				parent.processorArr[index].uiname = newName;
    			}
    			break;
    		case 'HDFS':
    		case 'HBASE':
    		case 'NOTIFICATION':
    			index = _.findIndex(parent.sinkArr, {uiname: oldName});
    			if(index !== -1){
    				parent.sinkArr[index].uiname = newName;
    			}
    			_.each(parent.processorArr, function(obj){
		    		if(obj.currentType === 'RULE'){
		    			var rules = obj.newConfig ? obj.newConfig.rulesProcessorConfig.rules : obj.rulesProcessorConfig.rules;
		    			_.each(rules, function(o){
		    				var index = _.findIndex(o.actions, {name: oldName});
		    				if(index !== -1){
		    					o.actions[index] = {name: newName};
		    				}
		    			});
		    		}
		    	});
		    	break;
    	}
    	var currentNode = _.findWhere(parent.topologyGraph.nodes, {uiname: oldName});
    	if(currentNode) currentNode.uiname = newName;
    };

    TopologyUtils.resetRule = function(processorArr, options){
        var ruleIndex = _.findIndex(processorArr, {uiname: options.resetRule.uiname});
        if(ruleIndex !== -1){
            var t_obj = processorArr[ruleIndex];
            if(t_obj.rulesProcessorConfig)
              delete t_obj.rulesProcessorConfig;
            else if(t_obj.newConfig){
              delete t_obj.newConfig;
            }
            t_obj.reset = true;
        }
    };

    TopologyUtils.resetRuleAction = function(processorArr, options){
        var ruleIndex = _.findIndex(processorArr, {uiname: options.resetRuleAction.uiname});
        if(ruleIndex !== -1){
            var t_object = processorArr[ruleIndex];
            var rules = t_object.newConfig ? t_object.newConfig.rulesProcessorConfig.rules : t_object.rulesProcessorConfig.rules;
            _.each(rules, function(o){
              var num = _.findIndex(o.actions, {name: options.data[0].uiname});
              if(num !== -1){
                o.actions.splice(num,1);
             }
            });
        }
    };

    return TopologyUtils;
});