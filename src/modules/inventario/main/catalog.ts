// Catálogo incluido: tipos de comercio (rubros) con sus categorías ya hechas y, para cada
// categoría, las variantes que suelen tener sus productos y sus valores habituales.
//
// Es un punto de partida, no una clasificación oficial: está escrito a mano, con las
// palabras que se usan en una tienda venezolana (franela, cauchos, koala, bombillo), y
// cada tienda lo ajusta después: añade, renombra u oculta categorías. Las tallas y medidas
// son las habituales, no una norma; se corrigen en Ajustes. El porqué de no usar una
// taxonomía externa está en docs/decisiones/0006-catalogo-por-rubro.md.
//
// Reglas (las comprueba categories.test.ts): cada categoría usa como mucho dos variantes;
// los nombres caben en sus campos; no hay rubros repetidos ni categorías repetidas dentro
// de un rubro.
//
// Cuando un producto pide un tercer eje, se resuelve con un valor combinado ("8/256 GB",
// "34B") o dejando el tercero en el nombre del producto ("Pintura de caucho mate").

import type { ProductKind } from "../api";

/** Un eje de variantes con sus valores habituales. */
export interface Attribute {
  name: string;
  values: readonly string[];
}

export interface CatalogCategory {
  name: string;
  kind?: ProductKind;
  /** Hasta dos variantes, en el orden en que se muestran. En un servicio son sus modalidades. */
  options?: readonly Attribute[];
}

export interface CatalogRubro {
  id: string;
  name: string;
  description: string;
  categories: readonly CatalogCategory[];
}

const attr = (name: string, ...values: string[]): Attribute => ({ name, values });

/* ---------- variantes habituales ---------- */

const COLOR = attr("Color", "Negro", "Blanco", "Gris", "Azul", "Azul marino", "Rojo", "Verde", "Amarillo", "Rosado", "Morado", "Beige", "Marrón", "Vinotinto");
const COLOR_EQUIPO = attr("Color", "Negro", "Blanco", "Gris", "Azul", "Dorado", "Plateado", "Rojo", "Verde");
const COLOR_ESCOLAR = attr("Color", "Negro", "Blanco");

const TALLA_ROPA = attr("Talla", "XS", "S", "M", "L", "XL", "2XL", "3XL");
const TALLA_PANTALON = attr("Talla", "28", "30", "32", "34", "36", "38", "40", "42", "44");
const TALLA_DAMA = attr("Talla", "6", "8", "10", "12", "14", "16");
const TALLA_NINO = attr("Talla", "2", "4", "6", "8", "10", "12", "14", "16");
const TALLA_BEBE = attr("Talla", "RN", "3M", "6M", "9M", "12M", "18M", "24M");
const TALLA_INTERIOR = attr("Talla", "S", "M", "L", "XL", "2XL");
const TALLA_SOSTEN = attr("Talla", "32A", "32B", "34A", "34B", "34C", "36B", "36C", "36D", "38B", "38C", "38D", "40C", "40D");
const TALLA_UNICA = attr("Talla", "Única", "Ajustable");
const TALLA_CALZADO = attr("Talla", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45");
const TALLA_CALZADO_DAMA = attr("Talla", "35", "36", "37", "38", "39", "40", "41");
const TALLA_CALZADO_CABALLERO = attr("Talla", "38", "39", "40", "41", "42", "43", "44", "45");
const TALLA_CALZADO_NINO = attr("Talla", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "31", "32", "33", "34");
const TALLA_MEDIAS = attr("Talla", "8-10", "9-11", "10-12");
const TALLA_ANILLO = attr("Talla", "5", "6", "7", "8", "9", "10", "11", "12");
const TALLA_CORREA = attr("Talla", "S", "M", "L", "XL");
const TALLA_MASCOTA = attr("Talla", "XS", "S", "M", "L", "XL");
const TALLA_PANAL = attr("Talla", "RN", "P", "M", "G", "XG", "XXG");

const MATERIAL_JOYA = attr("Material", "Oro 18k", "Plata 925", "Acero", "Goldfilled", "Bisutería");
const LARGO_CADENA = attr("Largo", "40 cm", "45 cm", "50 cm", "60 cm");
const TONO = attr("Tono", "Claro", "Medio", "Canela", "Oscuro");
const TONO_LABIAL = attr("Tono", "Nude", "Rosado", "Rojo", "Vino", "Marrón");
const TONO_TINTE = attr("Tono", "Negro", "Castaño", "Rubio", "Rojizo", "Fantasía");
const CONTENIDO_ML = attr("Contenido", "100 ml", "200 ml", "400 ml", "750 ml", "1 L");
const PERFUME_ML = attr("Contenido", "30 ml", "50 ml", "75 ml", "100 ml", "125 ml", "200 ml");

const MEMORIA_TELEFONO = attr("Memoria", "4/64 GB", "4/128 GB", "6/128 GB", "8/128 GB", "8/256 GB", "12/256 GB", "12/512 GB");
const CAPACIDAD = attr("Capacidad", "16 GB", "32 GB", "64 GB", "128 GB", "256 GB", "512 GB", "1 TB");
const CONECTOR = attr("Conector", "Tipo C", "Lightning", "Micro USB");
const LARGO_CABLE = attr("Largo", "1 m", "1,5 m", "2 m", "3 m");
const MODELO = attr("Modelo");
const POWERBANK = attr("Capacidad", "5.000 mAh", "10.000 mAh", "20.000 mAh");
const PULGADAS_TV = attr("Pulgadas", '32"', '43"', '50"', '55"', '65"');
const PULGADAS_MONITOR = attr("Pulgadas", '19"', '22"', '24"', '27"');
const BTU = attr("Capacidad", "9.000 BTU", "12.000 BTU", "18.000 BTU", "24.000 BTU");
const VOLTAJE = attr("Voltaje", "110 V", "220 V");
const COLOR_TINTA = attr("Color", "Negro", "Cian", "Magenta", "Amarillo");

const PRESENTACION_PINTURA = attr("Presentación", "1/4 de galón", "Galón", "Cuñete");
const COLOR_PINTURA = attr("Color", "Blanco", "Blanco ostra", "Marfil", "Beige", "Gris", "Negro", "Azul", "Verde", "Amarillo", "Rojo");
const DIAMETRO_TORNILLO = attr("Diámetro", "#6", "#8", "#10", '1/4"', '5/16"', '3/8"', '1/2"');
const LARGO_TORNILLO = attr("Largo", '1/2"', '3/4"', '1"', '1 1/4"', '1 1/2"', '2"', '2 1/2"', '3"');
const CALIBRE_CABLE = attr("Calibre", "18 AWG", "16 AWG", "14 AWG", "12 AWG", "10 AWG", "8 AWG");
const COLOR_CABLE = attr("Color", "Negro", "Rojo", "Azul", "Blanco", "Verde");
const DIAMETRO_TUBO = attr("Diámetro", '1/2"', '3/4"', '1"', '1 1/2"', '2"', '3"', '4"');
const POTENCIA = attr("Potencia", "7 W", "9 W", "12 W", "15 W", "18 W");
const LUZ = attr("Luz", "Blanca", "Cálida");
const ANCHO_BROCHA = attr("Ancho", '1"', '2"', '3"', '4"');
const MEDIDA_CANDADO = attr("Medida", "30 mm", "40 mm", "50 mm", "60 mm");
const DIAMETRO_CABILLA = attr("Diámetro", '3/8"', '1/2"', '5/8"');

const MEDIDA_CAUCHO = attr(
  "Medida",
  "175/70R13",
  "185/70R13",
  "175/65R14",
  "185/60R14",
  "185/65R14",
  "195/60R15",
  "195/65R15",
  "205/55R16",
  "205/60R16",
  "215/60R16",
  "265/70R16",
  "265/65R17"
);
const MEDIDA_CAUCHO_MOTO = attr("Medida", "2.75-18", "3.00-18", "90/90-18", "110/90-16", "4.10-18");
const MODELO_BATERIA = attr("Modelo", "22M-800", "22MR-800", "24M-1100", "24MR-1100", "34M-900", "34MR-900", "36MR-700", "42MR-800", "43M-900", "43MR-900");
const VISCOSIDAD = attr("Viscosidad", "20W-50", "15W-40", "10W-30", "5W-30");
const PRESENTACION_ACEITE = attr("Presentación", "1 litro", "Galón", "Paila");
const LADO = attr("Lado", "Izquierdo", "Derecho");

const PESO_EMPAQUE = attr("Presentación", "100 g", "200 g", "250 g", "400 g", "500 g", "900 g", "1 kg", "2 kg", "5 kg");
const PRESENTACION_BEBIDA = attr("Presentación", "250 ml", "355 ml", "500 ml", "600 ml", "1 L", "1,5 L", "2 L", "5 L");
const EMPAQUE = attr("Empaque", "Unidad", "Six pack", "Caja x12", "Caja x24", "Caja x36");
const EMPAQUE_HUEVOS = attr("Empaque", "Unidad", "Medio cartón (15)", "Cartón (30)");
const PRESENTACION_LIMPIEZA = attr("Presentación", "500 ml", "1 L", "2 L", "Galón");
const PRESENTACION_LICOR = attr("Presentación", "0,35 L", "0,70 L", "0,75 L", "1 L", "1,75 L");
const SABOR = attr("Sabor");
const AROMA = attr("Aroma");

const PRESENTACION = attr("Presentación");
const ETAPA_FORMULA = attr("Etapa", "Etapa 1", "Etapa 2", "Etapa 3");
const CANTIDAD = attr("Cantidad");

const RAYADO = attr("Rayado", "Una línea", "Doble línea", "Cuadriculado");
const HOJAS = attr("Hojas", "80 hojas", "100 hojas", "200 hojas");
const TAMANO_PAPEL = attr("Tamaño", "Carta", "Oficio", "Doble carta");
const COLOR_BOLIGRAFO = attr("Color", "Negro", "Azul", "Rojo");
const CAJA = attr("Cantidad", "x12", "x24", "x36");

const TAMANO_CAMA = attr("Tamaño", "Individual", "Matrimonial", "Queen", "King");
const TAMANO_PANO = attr("Tamaño", "De mano", "De baño", "Playero");
const TAMANO = attr("Tamaño", "Pequeño", "Mediano", "Grande");

const SACO_MASCOTA = attr("Peso", "1 kg", "2 kg", "4 kg", "8 kg", "15 kg", "18 kg", "20 kg");
const ETAPA_MASCOTA = attr("Etapa", "Cachorro", "Adulto", "Senior");
const PESO_ANIMAL = attr("Peso del animal", "Hasta 4 kg", "4-10 kg", "10-25 kg", "25-40 kg", "Más de 40 kg");

const RIN = attr("Rin", "12", "16", "20", "24", "26", "29");
const NUMERO_BALON = attr("Número", "3", "4", "5", "7");
const PESO_PESAS = attr("Peso", "2 kg", "5 kg", "10 kg", "15 kg", "20 kg");
const PRESENTACION_SUPLEMENTO = attr("Presentación", "300 g", "1 lb", "2 lb", "5 lb");

const TAMANO_COMIDA = attr("Tamaño", "Pequeño", "Mediano", "Grande");
const TAMANO_PIZZA = attr("Tamaño", "Personal", "Mediana", "Familiar");

// Modalidades de los servicios.
const PARA = attr("Para", "Caballero", "Dama", "Niño");
const LARGO_CABELLO = attr("Cabello", "Corto", "Medio", "Largo", "Extra largo");
const TECNICA_UNAS = attr("Técnica", "Tradicional", "Semipermanente", "Rubber");
const LARGO_UNAS = attr("Largo", "Cortas", "Medianas", "Largas");
const ZONA = attr("Zona", "Cejas", "Bozo", "Axilas", "Media pierna", "Pierna completa", "Bikini");
const DURACION = attr("Duración", "30 min", "60 min", "90 min");
const GAMA = attr("Gama", "Gama baja", "Gama media", "Gama alta");
const EQUIPO = attr("Equipo", "Teléfono", "Laptop", "PC", "Consola");
const PRENDA = attr("Prenda", "Pantalón", "Falda", "Vestido", "Camisa", "Chaqueta");
const PRENDA_TINTORERIA = attr("Prenda", "Camisa", "Pantalón", "Traje", "Vestido", "Chaqueta");
const VEHICULO = attr("Vehículo", "Moto", "Carro", "Camioneta", "Camión");
const TIPO_LAVADO = attr("Tipo", "Sencillo", "Completo", "Motor", "Chasis");
const IMPRESION = attr("Impresión", "Blanco y negro", "Color");
const TAMANO_PLASTIFICADO = attr("Tamaño", "Carnet", "Carta", "Oficio");
const FOTOS = attr("Cantidad", "x4", "x6", "x8");

/* ---------- atajos ---------- */

const c = (name: string, ...options: Attribute[]): CatalogCategory => (options.length ? { name, options } : { name });
const s = (name: string, ...options: Attribute[]): CatalogCategory =>
  options.length ? { name, kind: "servicio", options } : { name, kind: "servicio" };

/* ---------- rubros ---------- */

export const RUBROS: readonly CatalogRubro[] = [
  {
    id: "ropa",
    name: "Ropa y lencería",
    description: "Tiendas de ropa para dama, caballero, niños y bebés.",
    categories: [
      c("Franelas y chemises", TALLA_ROPA, COLOR),
      c("Camisas", TALLA_ROPA, COLOR),
      c("Blusas y tops", TALLA_ROPA, COLOR),
      c("Pantalones y jeans", TALLA_PANTALON, COLOR),
      c("Pantalones de dama", TALLA_DAMA, COLOR),
      c("Shorts, bermudas y faldas", TALLA_ROPA, COLOR),
      c("Vestidos y bragas", TALLA_ROPA, COLOR),
      c("Monos, licras y suéteres", TALLA_ROPA, COLOR),
      c("Chaquetas", TALLA_ROPA, COLOR),
      c("Interiores y bóxers", TALLA_INTERIOR, COLOR),
      c("Pantaletas", TALLA_INTERIOR, COLOR),
      c("Sostenes", TALLA_SOSTEN, COLOR),
      c("Pijamas y trajes de baño", TALLA_ROPA, COLOR),
      c("Ropa de bebé", TALLA_BEBE, COLOR),
      c("Ropa de niños", TALLA_NINO, COLOR),
      c("Uniformes escolares", TALLA_NINO, COLOR),
      c("Medias", TALLA_MEDIAS, COLOR),
      c("Gorras y accesorios", TALLA_UNICA, COLOR),
    ],
  },
  {
    id: "calzado",
    name: "Zapatería y carteras",
    description: "Calzado para toda la familia, carteras, morrales y correas.",
    categories: [
      c("Zapatos de dama", TALLA_CALZADO_DAMA, COLOR),
      c("Zapatos de caballero", TALLA_CALZADO_CABALLERO, COLOR),
      c("Zapatos de niños", TALLA_CALZADO_NINO, COLOR),
      c("Zapatos deportivos", TALLA_CALZADO, COLOR),
      c("Zapatos escolares", TALLA_CALZADO_NINO, COLOR_ESCOLAR),
      c("Sandalias", TALLA_CALZADO_DAMA, COLOR),
      c("Tacones", TALLA_CALZADO_DAMA, COLOR),
      c("Cholas", TALLA_CALZADO, COLOR),
      c("Botas y calzado de seguridad", TALLA_CALZADO_CABALLERO, COLOR),
      c("Carteras y bolsos", COLOR),
      c("Morrales y koalas", COLOR),
      c("Correas", TALLA_CORREA, COLOR),
      c("Plantillas y cuidado del calzado"),
    ],
  },
  {
    id: "accesorios",
    name: "Joyería, bisutería y accesorios",
    description: "Zarcillos, cadenas, relojes, lentes y detalles para regalar.",
    categories: [
      c("Zarcillos", MATERIAL_JOYA),
      c("Cadenas y collares", LARGO_CADENA, MATERIAL_JOYA),
      c("Pulseras", MATERIAL_JOYA),
      c("Anillos", TALLA_ANILLO, MATERIAL_JOYA),
      c("Relojes", COLOR),
      c("Lentes de sol", COLOR),
      c("Billeteras y monederos", COLOR),
      c("Accesorios para el cabello", COLOR),
      c("Bufandas y pañuelos", COLOR),
      c("Llaveros y detalles"),
    ],
  },
  {
    id: "belleza",
    name: "Cosméticos y perfumería",
    description: "Maquillaje, perfumes y productos para la piel y el cabello.",
    categories: [
      c("Maquillaje", TONO),
      c("Labiales", TONO_LABIAL),
      c("Esmaltes", COLOR),
      c("Perfumes y colonias", PERFUME_ML),
      c("Cuidado de la piel", CONTENIDO_ML),
      c("Champú y acondicionador", CONTENIDO_ML),
      c("Tintes", TONO_TINTE),
      c("Cremas corporales", CONTENIDO_ML),
      c("Desodorantes", AROMA),
      c("Brochas y accesorios de belleza"),
      c("Pestañas y uñas postizas"),
    ],
  },
  {
    id: "telefonos",
    name: "Celulares y tecnología",
    description: "Teléfonos, forros, cargadores, audífonos y accesorios de computación.",
    categories: [
      c("Teléfonos", MEMORIA_TELEFONO, COLOR_EQUIPO),
      c("Tablets y laptops", MEMORIA_TELEFONO, COLOR_EQUIPO),
      c("Relojes inteligentes", COLOR_EQUIPO),
      c("Forros", MODELO, COLOR),
      c("Vidrios templados", MODELO),
      c("Cargadores", CONECTOR),
      c("Cables", CONECTOR, LARGO_CABLE),
      c("Audífonos y cornetas", COLOR_EQUIPO),
      c("Memorias y pendrives", CAPACIDAD),
      c("Power banks", POWERBANK, COLOR_EQUIPO),
      c("Mouse, teclados y accesorios", COLOR_EQUIPO),
      c("Consolas y videojuegos"),
      c("Repuestos de teléfonos", MODELO),
    ],
  },
  {
    id: "electrodomesticos",
    name: "Electrodomésticos y electrónica",
    description: "Televisores, línea blanca, aires acondicionados y equipos de computación.",
    categories: [
      c("Televisores", PULGADAS_TV),
      c("Equipos de sonido"),
      c("Neveras y congeladores", attr("Capacidad"), attr("Color", "Blanco", "Gris", "Negro")),
      c("Cocinas y hornos"),
      c("Lavadoras y secadoras", attr("Capacidad")),
      c("Aires acondicionados", BTU, VOLTAJE),
      c("Ventiladores"),
      c("Licuadoras y electrodomésticos pequeños", COLOR),
      c("Computadoras", attr("Memoria", "4 GB", "8 GB", "16 GB", "32 GB"), attr("Disco", "256 GB", "512 GB", "1 TB")),
      c("Monitores", PULGADAS_MONITOR),
      c("Impresoras"),
      c("Tintas y tóner", COLOR_TINTA, MODELO),
      c("Reguladores y protectores", VOLTAJE),
    ],
  },
  {
    id: "ferreteria",
    name: "Ferretería, pinturas y electricidad",
    description: "Herramientas, tornillería, pinturas, plomería, electricidad y construcción.",
    categories: [
      c("Herramientas manuales"),
      c("Herramientas eléctricas"),
      c("Tornillos y fijación", DIAMETRO_TORNILLO, LARGO_TORNILLO),
      c("Pinturas", COLOR_PINTURA, PRESENTACION_PINTURA),
      c("Brochas, rodillos y lijas", ANCHO_BROCHA),
      c("Plomería", DIAMETRO_TUBO),
      c("Cables eléctricos", CALIBRE_CABLE, COLOR_CABLE),
      c("Bombillos y lámparas", POTENCIA, LUZ),
      c("Breakers, tomas y suiches"),
      c("Candados y cerraduras", MEDIDA_CANDADO),
      c("Cemento, cabillas y construcción", DIAMETRO_CABILLA),
      c("Pegas, silicón, teipe y tirro"),
      c("Mangueras, mecates y jardín"),
      c("Seguridad industrial", TALLA_ROPA),
    ],
  },
  {
    id: "repuestos",
    name: "Repuestos, cauchos y baterías",
    description: "Cauchos, baterías, aceites y repuestos para carros y motos.",
    categories: [
      c("Cauchos", MEDIDA_CAUCHO),
      c("Cauchos y tripas de moto", MEDIDA_CAUCHO_MOTO),
      c("Baterías", MODELO_BATERIA),
      c("Aceites y lubricantes", VISCOSIDAD, PRESENTACION_ACEITE),
      c("Filtros"),
      c("Frenos"),
      c("Bujías y encendido"),
      c("Correas y rolineras"),
      c("Suspensión y tren delantero", LADO),
      c("Bombillos, fusibles y eléctricos"),
      c("Repuestos de moto"),
      c("Cascos", TALLA_ROPA, COLOR),
      c("Accesorios y cuidado del carro"),
    ],
  },
  {
    id: "abasto",
    name: "Abasto y bodega",
    description: "Víveres, bebidas, charcutería, chucherías y productos de limpieza.",
    categories: [
      c("Víveres", PESO_EMPAQUE),
      c("Enlatados, salsas y aliños", PESO_EMPAQUE),
      c("Café, azúcar y bebidas en polvo", PESO_EMPAQUE),
      c("Refrescos, jugos y maltas", PRESENTACION_BEBIDA, SABOR),
      c("Agua y hielo", PRESENTACION_BEBIDA),
      c("Lácteos", PESO_EMPAQUE),
      c("Huevos", EMPAQUE_HUEVOS),
      c("Charcutería y quesos", attr("Presentación", "100 g", "250 g", "500 g", "1 kg")),
      c("Carnes, pollo y pescado", attr("Presentación", "500 g", "1 kg", "2 kg")),
      c("Frutas y verduras"),
      c("Pan, galletas y cereales", PESO_EMPAQUE),
      c("Chucherías y snacks", EMPAQUE),
      c("Limpieza del hogar", PRESENTACION_LIMPIEZA, AROMA),
      c("Cuidado personal", PRESENTACION),
      c("Pañales", TALLA_PANAL, CANTIDAD),
    ],
  },
  {
    id: "licoreria",
    name: "Licorería y bodegón",
    description: "Licores, cervezas, vinos, importados, refrescos y hielo.",
    categories: [
      c("Cervezas", attr("Presentación", "222 ml", "250 ml", "330 ml", "355 ml", "1 L"), EMPAQUE),
      c("Ron", PRESENTACION_LICOR),
      c("Whisky", PRESENTACION_LICOR),
      c("Vodka, ginebra y tequila", PRESENTACION_LICOR),
      c("Anís, aguardiente y cocuy", PRESENTACION_LICOR),
      c("Vinos y espumantes", PRESENTACION_LICOR),
      c("Sangrías y bebidas preparadas", PRESENTACION_BEBIDA, SABOR),
      c("Cremas y licores dulces", PRESENTACION_LICOR),
      c("Mezcladores y bebidas", PRESENTACION_BEBIDA),
      c("Hielo en bolsa", attr("Presentación", "Bolsa pequeña", "Bolsa grande")),
      c("Pasapalos"),
      c("Importados"),
      c("Cigarrillos y accesorios", attr("Empaque", "Unidad", "Caja")),
    ],
  },
  {
    id: "farmacia",
    name: "Farmacia y cuidado personal",
    description: "Medicinas, vitaminas, cuidado personal y artículos para el bebé.",
    categories: [
      c("Medicamentos", attr("Presentación", "Caja", "Blíster", "Unidad", "Frasco")),
      c("Vitaminas y suplementos", PRESENTACION),
      c("Primeros auxilios y equipos médicos"),
      c("Pañales de bebé", TALLA_PANAL, CANTIDAD),
      c("Fórmulas infantiles", ETAPA_FORMULA, attr("Presentación", "400 g", "900 g")),
      c("Teteros y accesorios de bebé"),
      c("Cuidado del cabello", CONTENIDO_ML),
      c("Cuidado bucal", PRESENTACION),
      c("Jabones, desodorantes y talcos", PRESENTACION, AROMA),
      c("Toallas sanitarias y protectores", CANTIDAD),
      c("Protección solar y piel", CONTENIDO_ML),
      c("Afeitadoras y depilación", CANTIDAD),
    ],
  },
  {
    id: "papeleria",
    name: "Papelería y piñatería",
    description: "Útiles escolares, artículos de oficina, cotillón y regalos.",
    categories: [
      c("Cuadernos, libretas y blocks", RAYADO, HOJAS),
      c("Lápices, bolígrafos y marcadores", COLOR_BOLIGRAFO, CAJA),
      c("Colores y creyones", CAJA),
      c("Papel, resmas y cartulinas", TAMANO_PAPEL, COLOR),
      c("Carpetas, sobres y archivo", TAMANO_PAPEL, COLOR),
      c("Pega, tirro, tijeras y engrapadoras"),
      c("Morrales, loncheras y cartucheras", COLOR),
      c("Arte y manualidades", COLOR),
      c("Calculadoras y oficina"),
      c("Piñatería y cotillón", attr("Motivo"), COLOR),
      c("Regalos y envoltorios", COLOR),
      c("Libros y textos escolares", attr("Grado")),
    ],
  },
  {
    id: "hogar",
    name: "Hogar y colchones",
    description: "Lencería, colchones, cocina, plásticos y decoración.",
    categories: [
      c("Colchones", TAMANO_CAMA),
      c("Sábanas y ropa de cama", TAMANO_CAMA, COLOR),
      c("Almohadas, cobijas y edredones", TAMANO_CAMA, COLOR),
      c("Paños", TAMANO_PANO, COLOR),
      c("Cortinas y alfombras", attr("Medida"), COLOR),
      c("Ollas, sartenes y utensilios", attr("Tamaño")),
      c("Vajillas, vasos y cubiertos", attr("Piezas"), COLOR),
      c("Tobos, poncheras y envases", attr("Capacidad"), COLOR),
      c("Cavas y termos", attr("Capacidad")),
      c("Decoración"),
      c("Lámparas"),
      c("Muebles", COLOR),
    ],
  },
  {
    id: "mascotas",
    name: "Mascotas y agro",
    description: "Alimento, accesorios y cuidado para mascotas, y productos para el campo.",
    categories: [
      c("Alimento para perros", SACO_MASCOTA, ETAPA_MASCOTA),
      c("Alimento para gatos", SACO_MASCOTA, ETAPA_MASCOTA),
      c("Snacks y premios", PRESENTACION),
      c("Arena y aseo", PRESENTACION),
      c("Antipulgas e higiene", PESO_ANIMAL),
      c("Medicinas veterinarias", PRESENTACION),
      c("Collares, correas y arneses", TALLA_MASCOTA, COLOR),
      c("Camas y transportadores", TALLA_MASCOTA),
      c("Juguetes y ropa de mascotas", TALLA_MASCOTA, COLOR),
      c("Aves, peces y roedores", PRESENTACION),
      c("Semillas, abonos y agro", PRESENTACION),
    ],
  },
  {
    id: "jugueteria",
    name: "Juguetería y bebés",
    description: "Juguetes, juegos, bicicletas y artículos para bebés.",
    categories: [
      c("Juguetes"),
      c("Muñecas y figuras"),
      c("Carros y pistas"),
      c("Juegos de mesa"),
      c("Juguetes didácticos"),
      c("Peluches", TAMANO),
      c("Bicicletas y triciclos", RIN, COLOR),
      c("Juegos de aire libre"),
      c("Coches y sillas de bebé", COLOR),
      c("Artículos de bebé"),
      c("Piñatas y fiestas"),
    ],
  },
  {
    id: "deportes",
    name: "Deportes",
    description: "Ropa y calzado deportivo, balones, gimnasio y suplementos.",
    categories: [
      c("Franelas y uniformes deportivos", TALLA_ROPA, COLOR),
      c("Licras y shorts deportivos", TALLA_ROPA, COLOR),
      c("Calzado deportivo", TALLA_CALZADO, COLOR),
      c("Balones", NUMERO_BALON),
      c("Guantes y bates", TALLA_ROPA),
      c("Pesas y gimnasio", PESO_PESAS),
      c("Suplementos deportivos", PRESENTACION_SUPLEMENTO, SABOR),
      c("Ciclismo", RIN),
      c("Natación", TALLA_ROPA),
      c("Camping y aire libre"),
      c("Termos y accesorios deportivos", COLOR),
    ],
  },
  {
    id: "comida",
    name: "Comida rápida y cafetería",
    description: "Locales que preparan comida para llevar: se vende por producto, sin mesas ni recetas.",
    categories: [
      c("Desayunos"),
      c("Empanadas y pastelitos", attr("Relleno", "Queso", "Carne molida", "Pollo", "Carne mechada", "Jamón y queso")),
      c("Arepas", attr("Relleno", "Queso", "Carne mechada", "Pollo", "Reina pepiada", "Pernil")),
      c("Hamburguesas y perros", attr("Tipo", "Sencilla", "Doble", "Especial")),
      c("Pizzas", TAMANO_PIZZA),
      c("Almuerzos"),
      c("Pollo y parrilla", attr("Porción", "1/4", "1/2", "Entero")),
      c("Tortas y dulces", attr("Porción", "Porción", "Entera")),
      c("Café", TAMANO_COMIDA),
      c("Jugos y batidos", TAMANO_COMIDA, SABOR),
      c("Refrescos y agua", PRESENTACION_BEBIDA),
      c("Helados", TAMANO_COMIDA, SABOR),
    ],
  },
  {
    id: "variedades",
    name: "Tienda general",
    description: "Venta de todo un poco: regalos, importados y artículos de temporada.",
    categories: [
      c("Variedades"),
      c("Regalos y detalles"),
      c("Artículos importados"),
      c("Artículos para el hogar"),
      c("Electrónica menor"),
      c("Temporada y fiestas"),
      c("Ofertas"),
    ],
  },
  {
    id: "peluqueria",
    name: "Peluquería y barbería",
    description: "Cortes, barba, color y tratamientos, y los productos que se venden en el local.",
    categories: [
      s("Cortes de cabello", PARA),
      s("Barba y afeitado"),
      s("Lavado, secado y peinado", LARGO_CABELLO),
      s("Color y mechas", LARGO_CABELLO),
      s("Alisados y keratina", LARGO_CABELLO),
      s("Tratamientos e hidratación", LARGO_CABELLO),
      s("Peinados para eventos"),
      s("Cejas y depilación facial"),
      c("Productos para el cabello", PRESENTACION),
    ],
  },
  {
    id: "estetica",
    name: "Uñas y estética",
    description: "Manicure, pedicure, uñas, pestañas, depilación, masajes y faciales.",
    categories: [
      s("Manicure", TECNICA_UNAS),
      s("Pedicure", attr("Técnica", "Tradicional", "Semipermanente", "Spa")),
      s("Uñas acrílicas", LARGO_UNAS),
      s("Retoque y retiro de uñas"),
      s("Decoración de uñas"),
      s("Cejas y pestañas"),
      s("Depilación", ZONA),
      s("Limpieza facial"),
      s("Masajes", DURACION),
      s("Maquillaje profesional"),
      c("Productos de estética", PRESENTACION),
    ],
  },
  {
    id: "servicio-tecnico",
    name: "Reparación de teléfonos y computadoras",
    description: "Servicio técnico con los repuestos y accesorios que se venden en el mostrador.",
    categories: [
      s("Revisión y diagnóstico"),
      s("Cambio de pantalla", GAMA),
      s("Cambio de batería", GAMA),
      s("Cambio de pin de carga", GAMA),
      s("Formateo, liberación y software"),
      s("Limpieza y mantenimiento", EQUIPO),
      s("Reparación de placa"),
      s("Instalación de programas"),
      s("Mano de obra"),
      c("Repuestos para reparación", MODELO),
      c("Accesorios en mostrador"),
    ],
  },
  {
    id: "costura",
    name: "Costura y arreglos",
    description: "Ruedos, cierres, ajustes, confección a la medida y mercería.",
    categories: [
      s("Ruedos", PRENDA),
      s("Cierres", PRENDA),
      s("Entalles y ajustes", PRENDA),
      s("Botones, ojales y broches"),
      s("Zurcidos y parches"),
      s("Confección a la medida"),
      s("Uniformes y bordados"),
      s("Cortinas y lencería de hogar"),
      c("Telas", attr("Tipo de tela"), COLOR),
      c("Mercería", COLOR),
    ],
  },
  {
    id: "lavanderia",
    name: "Lavandería y tintorería",
    description: "Lavado, secado, planchado y lavado en seco.",
    categories: [
      s("Lavado por kilo"),
      s("Lavado y secado por carga"),
      s("Solo secado"),
      s("Planchado"),
      s("Tintorería", PRENDA_TINTORERIA),
      s("Edredones y cobijas", TAMANO_CAMA),
      s("Cortinas y alfombras en lavandería"),
      s("Servicio express"),
      c("Detergentes y bolsas"),
    ],
  },
  {
    id: "copias",
    name: "Fotocopias, impresiones y cyber",
    description: "Copias, impresiones, escaneos, encuadernación y trámites en línea.",
    categories: [
      s("Copias", IMPRESION, TAMANO_PAPEL),
      s("Impresiones", IMPRESION, TAMANO_PAPEL),
      s("Escaneos"),
      s("Plastificado", TAMANO_PLASTIFICADO),
      s("Anillado y encuadernación", TAMANO_PAPEL),
      s("Fotos tipo carnet", FOTOS),
      s("Transcripciones y trámites en línea"),
      s("Internet y alquiler de equipos"),
      s("Impresión en gran formato"),
      c("Papelería básica"),
      c("Recargas y tarjetas"),
    ],
  },
  {
    id: "taller",
    name: "Taller mecánico, cauchera y autolavado",
    description: "Servicios para carros y motos, con los aceites y repuestos que se venden.",
    categories: [
      s("Mano de obra del taller"),
      s("Cambio de aceite y filtros", VEHICULO),
      s("Servicio de frenos", VEHICULO),
      s("Tren delantero y suspensión del taller"),
      s("Alineación y balanceo", VEHICULO),
      s("Electricidad y escáner"),
      s("Latonería y pintura"),
      s("Cauchera", VEHICULO),
      s("Lavado de vehículos", VEHICULO, TIPO_LAVADO),
      s("Pulitura y detallado", VEHICULO),
      c("Aceites para el servicio", VISCOSIDAD, PRESENTACION_ACEITE),
      c("Repuestos del taller"),
    ],
  },
];

/** La plantilla de variantes de una categoría del catálogo, lista para guardar. */
export function templateOf(category: CatalogCategory): { option1: string; values1: string[]; option2: string; values2: string[] } {
  const [first, second] = category.options ?? [];
  return {
    option1: first?.name ?? "",
    values1: first ? [...first.values] : [],
    option2: second?.name ?? "",
    values2: second ? [...second.values] : [],
  };
}
