; datasetGeneProbeAvg
(fn [dataset samples genes]
    (let [probemap (:probemap (car (query {:select [:probemap]
                                           :from [:dataset]
                                           :where [:= :name dataset]})))
          pmap-meta (:text (car (query {:select [:text]
                                        :from [:dataset]
                                        :where [:= :name probemap]})))
          get-probes (fn [gene] (xena-query {:select ["name" "position"] :from [probemap] :where [:in :any "genes" [gene]]}))
          avg (fn [scores] (mean scores 0))
          scores-for-gene (fn [gene]
              (let [probes (get-probes gene)
                    probe-names (probes "name")
                    scores (fetch [{:table dataset
                                    :samples samples
                                    :columns probe-names}])]
                {:gene gene
                 :position (probes "position")
                 :scores (if (car probes) (avg scores) [[]])}))]
      [pmap-meta (map scores-for-gene genes)]))
