# Cahier des charges – Simulateur de rentabilité d’article (v1)

## 1. Contexte et objectifs

* **Contexte** : l’entreprise souhaite mettre à disposition en interne un simulateur simple pour estimer la rentabilité d’un article (devis, prix cible, pilotage des marges).
* **Orientation data-first** : les données sources (articles, DT, nomenclatures, gammes, taux horaires, remises, etc.) seront **préparées en amont via des requêtes Sylob** et exposées au simulateur sous forme de services/exports normalisés.
* **Objectif** : livrer une **application web légère** (front + service d’accès aux données) utilisable par tous les collaborateurs (aucune installation locale), avec des calculs transparents et audités.

## 2. Périmètre fonctionnel

### 2.1 Must-have

1. **Sélecteurs hiérarchiques**

   * *Famille d’articles* → *Article* → *Donnée Technique (DT)*.
   * Une fois le couple *Article + DT* choisi, l’écran charge les **Matières** et **Opérations** correspondantes.
2. **Paramètres de simulation**

   * Quantité par lot (Qté lot).
   * Prix de vente unitaire HT.
   * Remise de fin d’année (%) appliquée sur le CA.
   * Frais fixes (%) **toujours calculés sur le CA net de remise**.
3. **Matières / composants**

   * Colonnes : Désignation, Qté nécessaire (par unité), Coût unitaire.
   * Le simulateur calcule la **Qté lot = Qté nécessaire × Qté lot** et le **sous-total matière**.
4. **Opérations**

   * Colonnes : Poste, Type (*Opérateur*, *Régleur*, *Sous-traitance*), Machine, **Cadence (u/h)**, **Taux horaire (€/h)**, **TRG (%)**, **Effectif**, Coût sous-traitance.
   * Règles d’édition :

     * Si *Sous-traitance* → seule la colonne *Coût sous-traitance* est saisissable (autres champs grisés).
     * TRG & Effectif actifs pour *Opérateur* ; *Régleur* n’applique pas de TRG (cf. formules).
5. **Sorties de calcul** (par lot et par unité)

   * Coûts matière, coûts opérations, **frais fixes (sur CA net)**, **coût de revient**, **coût unitaire**, **marge €**, **marge %**, **prix unitaire seuil de rentabilité**.
   * Graphe **camembert** (matière / opérations / frais fixes) avec couleurs distinctes.
6. **Import / Export**

   * Import d’un **JSON** de simulation.
   * Export d’un **JSON** incluant tous les paramètres et résultats clés.

### 2.2 Nice-to-have

* Historique des simulations, duplication, comparatifs A/B.
* Tables de taux horaires par atelier/période de validité.
* Rôles et droits (lecture / édition / admin) avec SSO d’entreprise.

## 3. Règles de gestion et formules

Soit :

* `qLot` = quantité par lot.
* **Matières** : pour chaque composant `i` : `SousTotalMat_i = qty_i_par_unité × qLot × coût_unitaire_i`.
* **Opérations** :

  * Si **Sous-traitance** : `SousTotalOp = coût_sous_traitance`.
  * Sinon :

    * `heures_lot = qLot / cadence_u_par_heure`
    * `facteur_TRG = (type == "Opérateur") ? (100 / TRG) : 1`
    * `SousTotalOp = heures_lot × taux_horaire × effectif × facteur_TRG`
* `Coûts directs = Σ SousTotalMat + Σ SousTotalOp`.
* `CA_net = prix_vente_unitaire × qLot × (1 - remise_EOY%)`.
* `Frais_fixes = (frais_fixes_% / 100) × CA_net`.
* `Coût_total = Coûts_directs + Frais_fixes`.
* `Coût_unitaire = Coût_total / qLot`.
* `Marge_€ = CA_net - Coût_total`.
* `Marge_% = (Marge_€ / CA_net) × 100` (si `CA_net > 0`).
* **Prix unitaire seuil de rentabilité** (sur CA net remis) :

  * `k = 1 - frais_fixes_%/100`
  * `Prix_seuil_unitaire = [ (Coûts_directs / k) / qLot ] / (1 - remise_EOY%)`.

> **Hypothèses** : *Régleur* n’applique pas de TRG (facteur = 1). *Sous-traitance* remonte un coût global par lot.

## 4. Données & Intégrations

### 4.1 Flux amont (préparés par Sylob)

Les équipes SI fourniront des vues/exports **déjà filtrables par Article et DT**. Deux options équivalentes :

* **Endpoints internes** (recommandé) :

  * `GET /api/articles?famille=...` → listes Familles, Articles par Famille, DT par Article.
  * `GET /api/bom?article=XXX&dt=YYY` → `{ components: [{ code, name, qty_per, unit_cost }] }`.
  * `GET /api/routing?article=XXX&dt=YYY` → `{ operations: [{ name, type, machine, hourly_rate, subcontract_cost, run_h_per_unit }] }`.
* **Exports fichiers** (JSON/CSV) déposés sur un partage interne ; l’app lit ces fichiers.

### 4.2 Mapping de champs attendu

* **BOM / Matières** :

  * `code`, `name`, `qty_per` (quantité par unité), `unit_cost` (€/unité).
* **Gamme / Opérations** :

  * `name`, `type` (valorisé en *Opérateur* / *Régleur* / *Sous-traitance*), `machine`,
  * `hourly_rate` (€/h), `subcontract_cost` (si sous-traitance),
  * `run_h_per_unit` (heures par unité) → **cadence calculée = `1 / run_h_per_unit`**.

### 4.3 Schémas JSON

```json
// /api/bom
{
  "components": [
    { "code": "AC-S235", "name": "Acier S235", "qty_per": 2, "unit_cost": 3.9 }
  ]
}
```

```json
// /api/routing
{
  "operations": [
    { "name": "Découpe laser", "type": "Opérateur", "machine": "Laser Bystronic", "hourly_rate": 55, "subcontract_cost": 0, "run_h_per_unit": 0.1 }
  ]
}
```

## 5. UX / UI

* **Écran unique** avec 3 zones :

  1. **Paramètres article** (Famille → Article → DT + paramètres de simulation),
  2. **Synthèse & camembert**,
  3. **Tableaux** matières et opérations.
* L’interface est **alignée au prototype React fourni** ; couleurs du camembert distinctes.
* Composants désactivés contextuellement (ex. champs grisés pour la sous-traitance).

## 6. Sécurité & accès

* Accès **intranet**. Option : **SSO d’entreprise** (Azure AD / Google / LDAP via IdP interne).
* Profilage minimal :

  * *Utilisateur* : lecture + simulation locale.
  * *Admin* : gestion des sources (liaisons, taux par atelier, paramètres par défaut).
* Journalisation : traçabilité des imports/exports et des appels aux endpoints.

## 7. Exigences non-fonctionnelles

* **Performance** : chargement initial < 2 s sur LAN, calculs < 100 ms pour 500 lignes cumulées.
* **Compatibilité** : Chrome/Edge/Firefox en versions supportées par l’IT.
* **Accessibilité** : contrastes conformes WCAG AA, navigation clavier.
* **Disponibilité** : 99,5 % sur heures ouvrées (si hébergement interne standard).

## 8. Déploiement & exploitation

* Le **prestataire serveur** fournit l’hébergement et expose les endpoints/fichiers des requêtes Sylob.
* L’application est fournie sous forme :

  * **Front web statique** + **service d’accès aux données** (proxy/adapter),
  * Variables d’environnement pour les URLs des flux Sylob.
* Observabilité : logs applicatifs, métriques d’erreur (5xx), temps de réponse.

## 9. Livrables attendus

* Code source (front + adapter d’accès aux données) et **documentation d’install**.
* **Contrats d’API** (OpenAPI/JSON Schema) et exemples.
* Jeux d’essai & **scénarios de recette**.
* Paquet de déploiement (archive ou image container) + guide d’exploitation.

## 10. Critères d’acceptation (exemples)

**Données d’essai** :

* Paramètres : `qLot = 100`, `prix_unitaire = 12,50 €`, `remise_EOY = 3 %`, `frais_fixes = 12 %`.
* Matières : 1 ligne `qty_per = 2`, `unit_cost = 3,90 €`.
* Opérations : 1 ligne *Opérateur* `cadence = 10 u/h`, `taux = 55 €/h`, `TRG = 100 %`, `effectif = 1`.

**Résultats attendus** :

* `Coûts matière = 780,00 €`
* `Coûts opérations = 550,00 €`
* `Coûts directs = 1 330,00 €`
* `CA net = 1 212,50 €`
* `Frais fixes (12 % du CA net) = 145,50 €`
* `Coût total = 1 475,50 €`
* `Coût unitaire = 14,755 €`
* `Marge lot = −263,00 €`
* `Marge % = −21,69 %`
* `Prix unitaire seuil de rentabilité ≈ 15,581 €`

La **courbe/sectorielle** doit refléter ces valeurs (matière/opérations/frais fixes).

## 11. Planning & gouvernance (indication)

* Cadrage & ateliers : 1–2 semaines (cartographie des requêtes Sylob et contrats d’API).
* Dév & intégration : itérations courtes avec démonstrations fin de sprint.
* Recette métier : 1 semaine avec jeux d’essai.
* Mise en service : bascule + support hypercare.

## 12. Risques & mesures

* Écarts de structure entre vues Sylob et contrats attendus → **adapter** un mapping (adapter/ETL léger).
* Qualité des données (taux horaires, TRG, effectif) → référentiels à maintenir.
* Sensibilité des coûts → contrôle d’accès + chiffrement en transit.

---

**Annexe A – Schémas (détaillés)**

```ts
// Matière côté front
interface Material { id: string; name: string; qty: number; unitCost: number; }

// Opération côté front
interface Operation {
  id: string; name: string; type: 'Opérateur'|'Régleur'|'Sous-traitance'; machine: string;
  cadenceH: number; hourlyRate: number; trgPct: number; crew: number; subcontractCost: number;
}
```

```json
// Export de simulation (JSON)
{
  "family": "Tôlerie",
  "articleRef": "ART-0001",
  "selectedTechnical": "Laser A",
  "batchQty": 100,
  "salePrice": 12.5,
  "eoyDiscountPct": 3,
  "overheadPct": 12,
  "materials": [ { "name": "Acier S235", "qty": 2, "unitCost": 3.9 } ],
  "operations": [ { "name": "Découpe laser", "type": "Opérateur", "machine": "Laser Bystronic", "cadenceH": 10, "hourlyRate": 55, "trgPct": 100, "crew": 1, "subcontractCost": 0 } ]
}
```

**Annexe B – Table de correspondance**

* `run_h_per_unit` (Sylob) → `cadenceH = 1 / run_h_per_unit` (app).
* Champs Sylob *Type\_Operation* → mapping { Sous-traitance | Régleur | Opérateur }.

**Fin du document**.
