/*jslint browser:true, nomen: true */
/*global define: false, confirm: true */

// http://localhost:8080/datapages/?ga4gh=1&start=41215898&end=51215899&referenceName=17&variantSetId=Clinvar
// http://localhost:8080/datapages/?ga4gh=1&start=41215898&end=41215899&referenceName=17&variantSetId=Clinvar

// http://http://localhost:8080/datapages/?ga4gh=1

define(["ga4ghQuery", "dom_helper", "metadataStub", "rx-dom", "underscore_ext","../css/datapages.css"],
  function (ga4ghQuery, dom_helper, metadataStub, Rx, _) {
  'use strict';

  var url = "http://ec2-54-148-207-224.us-west-2.compute.amazonaws.com:8000/v0.6.e6d6074";
    //var url = "http://ec2-54-148-207-224.us-west-2.compute.amazonaws.com/ga4gh/v0.5.1";

  function start(query_string, baseNode){
    var source = Rx.Observable.zipArray(ga4ghQuery.variantSetsQuery(url), //from server
      ga4ghQuery.metadata(url, "Clinvar")),  //stub
      serverMeta ={}, stubMeta={},
      metadata={};

    source.subscribe(function (x){
      //server
      x[0].map(function(r){
        serverMeta[r.id] = r.metadata;
      });
     //stub
      x[1].map(function(r){
        stubMeta[r.id] = r.metadata;
      });

      //organize metadata
      Object.keys(serverMeta).map(function (dataset){
        metadata[dataset]=buildMetaDataJSON(serverMeta[dataset]);
        if (stubMeta[dataset]){
          update(metadata[dataset], stubMeta[dataset]);
        }
      });


      if (!query_string.start || !query_string.end || !query_string.referenceName ){
        searchPage(baseNode, metadata);
      }
      else {
        queryStringPage(query_string, metadata, baseNode);
      }

    });
  }

  function buildMetaDataJSON(meta){
    var metaDataJSON ={};
    meta.map(function(item){
      metaDataJSON[item.key]= item;
    });
    return metaDataJSON;

  }

  function update(meta, newMeta){
    newMeta.map(function(item){
      if (meta[item.key]){
        meta[item.key] = item;
      }
    });
  }


  function queryVariants(startPos, endPos, referenceName, variantSetId){
    if (!isNaN(startPos) && !isNaN(endPos) && referenceName && variantSetId){
      return ga4ghQuery.variants({
        url:url,
        start: startPos,
        end: endPos,
        chrom: referenceName,
        dataset: variantSetId
      });
    }
  }

  function queryStringPage(query_string, metadata, basenode){
    var startPos =  parseInt(query_string.start)-1,
      endPos = parseInt(query_string.end),
      referenceName = query_string.referenceName,
      variantSetIds = query_string.variantSetId ?
        [query_string.variantSetId] : ["Clinvar","lovd","1000_genomes","umd"],
      allVariants=[],
      queryArray = variantSetIds.map(
        variantSetId=>queryVariants(startPos, endPos, referenceName, variantSetId)),
      query = Rx.Observable.zipArray(queryArray),
      node= dom_helper.sectionNode("dataset");

      query.subscribe(function (ret) {
        ret.map(function(results){
          var index = ret.indexOf(results),
            variantSetId = variantSetIds[index];
          results.map(function (variant){
            var div = document.createElement("div");
            if ( allVariants.indexOf(variant.id)===-1){
              buildVariantDisplay(variant, div, metadata[variantSetId]);
              node.appendChild(div);
              allVariants.push(variant.id);
            }
          });
        });
      });
      basenode.appendChild(node);
  }

  function searchPage (baseNode, metadata){
    var frameset = document.createElement("frameset"),
      fLeft = document.createElement('frame'),
      fRight = document.createElement('frame'),
      startInput = document.createElement("INPUT"),
      endInput = document.createElement("INPUT"),
      chromInput = document.createElement("INPUT"),
      searchButton = document.createElement("BUTTON"),
      div,
      leftBaseNode = document.createElement("div"),
      rightBaseNode = document.createElement("div"),
      startPos, endPos, referenceName, variantSetId,
      variantSetIds,
      query;

    chromInput.setAttribute("value","17");
    startInput.setAttribute("value","41215824");
    endInput.setAttribute("value","41215900");
    variantSetIds = Object.keys(metadata);

    baseNode.appendChild(frameset);
    frameset.setAttribute("cols","25%,75%");
    frameset.appendChild(fLeft);
    frameset.appendChild(fRight);

    fLeft.contentDocument.body.appendChild(leftBaseNode);
    fRight.contentDocument.body.appendChild(rightBaseNode);

    leftBaseNode.setAttribute("id","leftFrame");
    leftBaseNode.appendChild(dom_helper.elt("labelsameLength","Chr"));
    leftBaseNode.appendChild(dom_helper.elt("resultsameLength", chromInput));
    leftBaseNode.appendChild(document.createElement("br"));

    leftBaseNode.appendChild(dom_helper.elt("labelsameLength","Start"));
    leftBaseNode.appendChild(dom_helper.elt("resultsameLength", startInput));
    leftBaseNode.appendChild(document.createElement("br"));

    leftBaseNode.appendChild(dom_helper.elt("labelsameLength","End"));
    leftBaseNode.appendChild(dom_helper.elt("resultsameLength", endInput));
    leftBaseNode.appendChild(document.createElement("br"));

    variantSetIds.map(function(id){
      div = document.createElement("input");
      div.setAttribute("type","checkbox");
      div.setAttribute("id","variantSetId_"+ id);
      div.setAttribute("checked", true);
      leftBaseNode.appendChild(div);
      leftBaseNode.appendChild(document.createTextNode(id));
      leftBaseNode.appendChild(document.createElement("br"));
    });

    searchButton.setAttribute("class","vizbutton");
    searchButton.appendChild(document.createTextNode("Search"));
    leftBaseNode.appendChild(searchButton);

    searchButton.addEventListener("click", function () {
      startPos = parseInt(startInput.value.trim())-1;
      endPos = parseInt(endInput.value.trim());
      referenceName = chromInput.value.trim();

      rightBaseNode.innerHTML="";
      variantSetIds.map(function(id){
        if (fLeft.contentDocument.getElementById("variantSetId_"+ id).checked){
          query = queryVariants(startPos, endPos, referenceName, id);
          query.subscribe(function (results) {
            results.map(function (variant){
              var div = document.createElement("div");
              buildVariantDisplay(variant, div, metadata[id]);
              rightBaseNode.appendChild(div);
            });
          });
        }

      });
    });
  }

  function buildVariantDisplay(variant, node, metaData) {
    var id = variant.id,
      chr = variant.referenceName,
      startPos = variant.start +1,
      endPos = variant.end,
      reference = variant.referenceBases,
      alt = variant.alternateBases,
      variantSetId = variant.variantSetId,
      label,div,
      selectedKeys, allKeys, otherKeys;

    function displayKeyValuePair (key, bold){
        var value, intepretation, text;

        value = eval("variant."+key);
        if (metaData[key]){
          label = metaData[key].description;
          label = label.charAt(0).toUpperCase()+ label.slice(1);
          if ( metaData[key].type ==="Flag") {
            if (value) {
              node.appendChild(document.createTextNode(label+ " : "));
              text = value[0];
            }
          }
          else if ( metaData[key].type ==="Integer"){
            node.appendChild(document.createTextNode(label+" : "));
            intepretation = metaData[key].info[value];
            text = intepretation? intepretation: value[0];
          }
          else if ( metaData[key].type ==="Float"){
            node.appendChild(document.createTextNode(label+" : "));
            text = value[0];
          }
          else if ( metaData[key].type ==="String") {
            node.appendChild(document.createTextNode(label+" : "));
            if (Object.keys(metaData[key].info).length){
              text = value[0].split(",").map(function(oneValue){
                intepretation = _.uniq(oneValue.split("|").map(function(v){
                  return metaData[key].info[v];
                })).join(" | ");
                return intepretation;
              }).join(", ");
            } else {
              text = value[0].split(",").map(function(oneValue){
                return oneValue.replace(/\\x2c/g, "");  // clean up messy data with \x2c characters
              }).join(", ");
            }
          }

          if (text){
            if (bold){
              div = document.createElement("b");
              node.appendChild(div);
              div.appendChild(document.createTextNode(text));
            } else {
              node.appendChild(document.createTextNode(text));
            }
            node.appendChild(document.createElement("br"));
            node.appendChild(document.createElement("br"));
          }
        }
      }


    selectedKeys = metadataStub.selectedKeys[variantSetId];
    allKeys =Object.keys(variant.info).map(key=>"INFO."+key);
    if (!selectedKeys){
      otherKeys = allKeys;
    } else {
      otherKeys = allKeys.filter(key=>(selectedKeys.indexOf(key)===-1));
    }
    variant.INFO = variant.info;

    node.appendChild (dom_helper.elt("h2",id));
    //chr start (- end)
    node.appendChild(document.createTextNode("chr"+ chr+":"));
    node.appendChild(document.createTextNode(" "+ startPos.toLocaleString()));
    if (startPos !== endPos) {
      node.appendChild(document.createTextNode(" - "+ endPos.toLocaleString()));
    }
    node.appendChild(document.createElement("br"));
    //ref, alt
    node.appendChild(document.createTextNode("Reference sequence : "));
    node.appendChild(dom_helper.elt("b", reference));
    node.appendChild(document.createElement("br"));
    node.appendChild(document.createTextNode("Variant sequences : "));
    div = document.createElement("b");
    node.appendChild(div);
    div.appendChild(document.createTextNode(alt));
    node.appendChild(document.createElement("br"));
    node.appendChild(document.createElement("br"));
    //info
    if (metaData){
      var bold;
      if (selectedKeys){
        bold = true;
        selectedKeys.map(key=>displayKeyValuePair(key, bold));
      }
      if (otherKeys){
        bold = false;
        otherKeys.sort().map(key=>displayKeyValuePair(key, bold));
      }
    }
  }

  return {
    start: start
  };
});
