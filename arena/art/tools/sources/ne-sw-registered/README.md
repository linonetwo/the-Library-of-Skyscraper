# Registered NE/SW source attachments

These transparent PNGs are final authoring pixels at the 192px canvas scale. They are shared by the four frozen player clip configurations; each configuration includes the joint hierarchy, pivots, layer order, image paths, pose targets and anatomical world registration needed to rebuild its output. `sourceScale` is provenance and must not be applied again.

Sources were generated through proxy-imagegen and manually registered in the independent art tree: complete body/limbs source SHA256 `cac3906aa12b5ac8c7686bbb64ad591c54c884d52c4ead091e27bbdf2c61018d`; warden registration `907b40a`, midnight registration `c2323e3`, staff/hand split `2f2a47e` with angle metadata `0df77a7`. The original large generated sheets are not required by the offline pose exporter: these registered transparent crops are its actual source inputs. No image-generation service is called during rebuilding.

The semantic configurations and tool snapshot were frozen from tools commit `6fce079`, including walk `8a105dd`, attack `3da7676`, hit `099b4a7`, and breathing idle `01fcf4a`. The files were deduplicated without changing their bytes or registration. Appearance combinations remain independent layers rather than eight whole-person images.
