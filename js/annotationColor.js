/*global module: false, require: false */
'use strict';

var index = o => _.object(o, _.range(o.length));

var colorSettings ={
  clinvar: {
      //"0": "uncertain significance",
      //"1": "not provided",
      //"2": "Benign",
      //"3": "Likely benign",
      //"4": "Likely pathogenic",
      //"5": "Pathogenic",
      //"6": "Drug response",
      //"7": "Histocompatibility",
      //"255": "Other"
    CLNSIG: {
      color: d3.scale.ordinal().domain(['255','0',"1",'2', '3', '4', '5', '6', '7'])
        .range(['green','black','lightgrey','blue', 'lightblue', 'pink', 'red', 'orange', 'orange']),
      filter: ['1','255','6', '7', '0', '3', '2', '4', '5'],
      order: index(['1','255','0', '6', '7', '3', '2', '4', '5']),
    },

    // 1, 3 => germ line
    // 2, 3 => somatic
    CLNORIGIN: {
      color: d3.scale.ordinal().domain(['1', '2', '3'])
        .range(['blue', 'red', 'purple']),
      filter: ['1', '2', '3'],
      order: index(['1', '2', '3']),
    },

    //"1-Notpathogenicorofnoclinicalsignificance",
    //"2-Likelynotpathogenicoroflittleclinicalsignificance",
    //"3-Uncertain",
    //"4-Likelypathogenic",
    //"5-Definitelypathogenic",
    iarc_class: {
      color: d3.scale.ordinal().domain(['1', '2','3','4','5'])
        .range(['blue', 'lightblue', 'black', 'pink', 'red']),
      filter: ['3','2','1','4','5'],
      order: index(['3','2','1','4','5']),
    }
  }
};

module.exports = {
  colorSettings: colorSettings
};
