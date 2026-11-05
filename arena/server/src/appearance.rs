use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Outfit {
    Scholar,
    Warden,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Hair {
    Ivory,
    Midnight,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct Appearance {
    pub outfit: Outfit,
    pub hair: Hair,
    pub weapon: bool,
}

impl Appearance {
    pub fn for_role(role: &str) -> Self {
        Self {
            outfit: if role == "guard" {
                Outfit::Warden
            } else {
                Outfit::Scholar
            },
            hair: Hair::Ivory,
            weapon: true,
        }
    }
}
