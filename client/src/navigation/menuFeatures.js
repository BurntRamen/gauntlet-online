// Unfinished menu customization is available only in explicitly enabled review builds.
// Normal builds render default layouts and never initialize layout persistence.
export const MENU_LAYOUT_CUSTOMIZATION_ENABLED = process.env.REACT_APP_MENU_LAYOUT_CUSTOMIZATION === 'true';
