#!/usr/bin/env python3
"""The image prompts for the rides' sheet art and top-down tokens (assets/art/rides, assets/art/tokens).

Each look is a plain description of the vehicle as the 2077 setting shows it, with no names: the image
generator refuses franchise and brand names. Prints the prompts as JSON: [[label, prompt], ...], where the
label is "v2:<slug>" for the sheet art and "v2td:<slug>" for the token.
"""
import json
import sys

D = {}  # slug -> (look, flags); flags: l = luxury finish, b = bike, a = flies, w = afloat, p = powered armor


def add(slug, s, f=""):
    D[slug] = (s, f)


def fam(base, f="", **v):
    for k, x in v.items():
        add(k.replace("_", "-"), base + x, f)


NCPD = "in black-and-white police livery with a blue stripe, a red-and-blue roof light bar and a steel push bar"
NCPD_AIR = "in black-and-white police livery with a blue stripe and red-and-blue strobe lights"
MAXTAC = "in matte charcoal-black tactical police livery with indigo-blue markings and red-and-blue strobe lights"


def av(body, extra=""):
    return (f"a wingless, rotorless flying aerodyne shaped like a long armored capsule with chamfered edges, with no rotors, propellers, fans, wings or external engine pods: {body}, "
            f"a sloped wedge nose with a narrow slit windshield, and four vectored-thrust jets recessed inside bulky armored housings built flush into the front and rear flanks of the hull, "
            f"with exhaust vanes underneath glowing orange{extra}")


A = "a"
add("zetatech-atlus", av("a stocky rounded utility hull in worn white and grey with sliding side doors and hazard stripes", ", small landing skids"), A)
add("rayfield-excalibur", "a wingless, rotorless flying luxury aerodyne with no rotors, propellers, fans or external engine pods: a very long, flat, dart-shaped limousine hull in glossy midnight blue "
    "with a long glass canopy flowing into a tapering tail, and vectored-thrust jets hidden inside smooth round housings in its flanks, glowing softly underneath", "al")
add("militech-manticore", av("a hulking windowless gunship hull in dark navy-black armor with heavy slab side doors, a troop bay and stubby weapon racks", ", small yellow thrust vanes and a chin gun"), A)
add("dayton-hc-48-thunderbird", av("a huge heavy-lift cargo hull in faded yellow with a ribbed cargo bay, a rear loading ramp and a belly winch", ", oversized engine housings"), A)
add("maxtac-surveyor", av("a long bus-sized armored troop-carrier hull " + MAXTAC + " with sliding troop doors", ", a remote missile launcher on the roof and a chin gun"), A)
add("militech-manticore-herakles", av("a stocky older-model military gunship hull in sand-and-olive armor plate with a side door gun", ", a nose machine gun"), A)
add("militech-manticore-maxtac", av("a hulking windowless gunship hull " + MAXTAC + " with heavy slab side doors, a troop bay and searchlights", ", small yellow thrust vanes and a chin gun"), A)
add("militech-manticore-herakles-maxtac", av("a stocky older-model gunship hull " + MAXTAC + " with a side door gun and searchlights", ", a nose machine gun"), A)
add("rayfield-excalibur-destination", av("a compact sleek four-seat executive hull in pearl white with a glass canopy and silver trim", ", the engines hidden behind smooth round covers"), "al")
add("rayfield-honoree", av("a long elegant flat limousine hull in deep burgundy with chrome trim and a long glass canopy", ", the engines hidden behind smooth round covers"), "al")
add("rayfield-prydwen", av("a razor-sharp flat dart-shaped stealth hull in matte black with faceted radar-deflecting panels and a mirrored canopy", ", the engines hidden behind flush covers"), "al")
add("trauma-team-atlus", av("a stocky rounded armored air-ambulance hull in white with teal and red stripes, sliding side doors and a door gun", ", emergency lights and landing skids"), A)
add("zetatech-aero-enforcer", av("a compact nimble pursuit hull " + NCPD_AIR, ", a searchlight under the nose"), A)
CAN = ("a small rotorless flying aerodyne: a compact boxy tub-shaped cabin {} carried by four articulated thruster arms in yellow rising from its top corners, "
       "each ending in a downward jet nozzle glowing orange{}")
add("zetatech-canopy", CAN.format("in teal with big side windows", ""), A)
add("zetatech-canopy-ncpd", CAN.format(NCPD_AIR, ", with a nose machine gun and a searchlight"), A)
add("zetatech-surveyor", av("a long bus-sized rounded passenger capsule hull in orange and dark grey", ", a remote missile launcher on the roof"), A)
add("thorton-colby-vaquero", "a flying open-topped off-road jeep with no roof and no glass: a boxy rugged jeep body in dusty red with a roll bar, an empty weapon ring mount, "
    "and four small swivelling jet thrusters where the wheels would be, nozzles glowing orange-hot", A)

ZEP = ("a huge rigid flying aerozep with no balloon, no gasbag and no wings: a very long, blocky, flat-sided rectangular hull built from boxy slab modules like a flying freight train, {}, "
       "a row of round lift fans set flush into its flat underside, a blunt squared bow and a big cylindrical jet thruster glowing orange at the stern")
add("dayton-m405-adzep", ZEP.format("in teal-blue with giant glowing advertising screens along both sides"), A)
add("garbage-aerozep", ZEP.format("in grimy municipal orange and grey, its open-topped middle heaped with compacted trash, with a dump chute under the bow"), A)
add("dayton-sky-queen", ZEP.format("a colossal luxury liner in white and gold with long rows of lit windows, promenade decks and rocket pods at the corners"), "al")
add("barghest-combat-zep", ZEP.format("a militia warship in olive drab with bolted armor plate, gun turrets along the roof and sides and searchlights"), A)

B = "b"
NAZ = "a muscular naked street motorcycle with a chunky fuel tank, an exposed engine, a round headlight, very fat tires on solid disc wheels and a stubby exhaust, "
fam(NAZ, B, arch_nazar="in gunmetal with gold wheels", arch_nazar_kobold="with matte black armor fairings and nitrous bottles",
    arch_nazar_itsumade="a street-gang custom in white and red with gold trim and neon underglow", arch_nazar_racer="stripped for racing in yellow with a small race fairing and slick tires")
add("arch-substance-171", "a brutal oversized superbike, very long and low, with a huge exposed turbine engine, a massive rear tire, a tiny seat and a narrow slit headlight, in black with red glow", B)
APO = "a rugged retro scrambler motorcycle with a round headlight, a flat bench seat, a high-mounted exhaust, knobby tires and an exposed orange tube frame, "
fam(APO, B, brennan_apollo="with black hard panniers", brennan_apollo_650_s="a clean street version in red",
    brennan_apollo_650_s_scout="in black-and-white police livery with a small windshield and red-and-blue lights",
    brennan_apollo_barghest="in militia olive green with bolted armor plates", brennan_apollo_frankenbike="a chopper custom built from mismatched parts",
    brennan_apollo_harriet="a touring version with leather saddlebags", brennan_apollo_merc="with a machine gun and a rocket pod bolted to the front forks")
add("brennan-apollo-artemis", "a sleek enclosed racing motorcycle with a closing glass canopy over the rider, a long faired body and armored panels, in dark blue", B)
add("brennan-apollo-cicada", "a small lightweight trail dirt bike with a thin frame, a high fender, knobby tires and a tiny tank, in green", B)
add("brennan-apollo-range-trike", "a heavy armored three-wheeled trike with one front wheel and two wide rear wheels, a three-person bench seat and armor plating, in dusty brown", B)
KUS = "a long, low, fully-faired futuristic Japanese sport motorcycle with a forward-leaning riding position, thick exposed tires on solid disc wheels, a hugging front fender and a sharp wedge nose, "
fam(KUS, B, yaiba_kusanagi_ct_3x="in red and white", yaiba_kusanagi_sliver="a slim silver commuter version with a tall windshield",
    yaiba_kusanagi_akashita="in matte black stealth plating with red accents", yaiba_kusanagi_misfit="a scrappy punk custom in yellow with a sidecar and a rocket pod",
    yaiba_kusanagi_mizuchi="in deep blue stealth plating with a scale pattern", yaiba_kusanagi_peacekeeper="in gunmetal with thick bolted armor plates")
add("yaiba-asm-r250-muramasa", "a long, low futuristic cruiser superbike with two giant solid disc wheels, a smooth one-piece body flowing over the rear wheel and a tiny slit headlight, in polished chrome silver", B)

HELLA = "a formal boxy three-box four-door economy sedan in a 1980s style with a flat hood, an upright chrome grille, quad rectangular headlights and a squared trunk, "
fam(HELLA, archer_hella_ec_d_i360_2023="old and battered in faded brown-grey", archer_hella_ec_h_i860_ncpd_enforcer=NCPD, archer_hella_ec_v_i660_voyage="built as one long-roofed station wagon with a rear hatch and a roof rack, in blue")
QZ = "a compact 1980s-style two-door notchback coupe with a low wedge nose, slim rectangular headlights, a short trunk and squared wheel arches, "
fam(QZ, archer_quartz_ec_l_r275="in dull brown", archer_quartz_ec_t2_r660="a wide sporty version in red with a rear spoiler",
    archer_quartz_bandit="a desert raider version: lifted, with a roll cage, rally lights, stripped panels and sand paint",
    archer_quartz_sidewinder="an off-road version in olive with a lift kit, armor plates and big knobby tires",
    archer_quartz_specter="an off-road version in matte black with tinted windows and big knobby tires")
add("chevalier-sbz-midas", "an opulent grand-touring hypercar plated in gold with a very long hood, a sweeping fastback, covered rear wheels and mirrored glass", "l")
CENT = "a big boxy 1980s-American-style heavy flatbed truck with a square cab, a tall grille, stacked rectangular headlights and an open steel flatbed, "
fam(CENT, chevillon_centurion_1000_single_axle="with a single rear axle, in white", chevillon_centurion_1000_dual_axle="with two rear axles and a longer bed, in blue")
EMP = "a massive tall boxy luxury SUV with slab sides, a towering grille of vertical chrome slats, slim stacked headlights, blacked-out windows and huge wheels, "
fam(EMP, chevillon_emperor_620_ragnar="in two-tone blue and white", chevillon_emperor_620_ragnar_gang_barge="lowered, in candy purple with gold trim and gold wheels",
    chevillon_emperor_620_ragnar_militech="in matte olive-grey corporate security trim with antennas and a roof light bar",
    chevillon_emperor_620_ragnar_limousine="stretched into a six-door limousine in gloss black", chevillon_emperor_720_ncpd_ironclad="armored, " + NCPD + " and a ram plow")
add("chevillon-centurion-1000-reo-meatwagon", "a decades-old box ambulance: a boxy 1980s-American-style truck cab with a tall square patient box body behind it and rear double doors, "
    "in dirty white with red and blue diagonal stripes, dented panels, rust streaks and a roof light bar of purple-white emergency lights")
add("chevillon-legatus-450-aquila", "a towering brutish armored heavy-duty crew-cab truck with a reinforced ram grille, exposed bolts, a covered rear and huge tires, in rusty black with acid-yellow war paint")
CAB = "an armored taxi in orange-yellow with a black checkered band along its sides, a steel ram bumper, mesh guards over the lights and a roof taxi light"
add("chevillon-thrax-388-jefferson-combat-cab", "a long, low 1970s-American-style fastback sedan with a very long hood, a tall upright chrome waterfall grille and a sloping rear roofline, " + CAB)
add("chevillon-emperor-620-ragnar-combat-cab", EMP + CAB + ", with a machine gun on a roof mount")
add("chevillon-thrax-388-jefferson", "a long, low 1970s-American-style luxury fastback sedan with a very long hood, a tall upright chrome waterfall grille, a sloping rear roofline and rear fender skirts, in silver")
add("herrera-longtail", "a streamlined endurance-racer-style hypercar with a low bubble canopy, covered rear wheels and a very long tapering tail, in burgundy", "l")
OUT = "a sleek futuristic four-door luxury fastback sports sedan with a long sculpted hood, a narrow slit grille, razor-thin headlights and a sweeping roofline, "
fam(OUT, "l", herrera_outlaw_gts="in deep teal with underglow", herrera_outlaw_weiler="armored, in gunmetal with gun ports in the nose")
RIP = "a low two-seat 1980s-style wedge sports car with a sharp flat nose, a targa roof, big side intakes and a louvred engine cover, "
fam(RIP, "l", herrera_riptide_gt2="in red", herrera_riptide_terrier="a rare racing version in white with exposed side exhausts and a roll hoop")
add("herrera-thunderbolt", "a low, wide mid-engined grand tourer with a glass canopy, big side intakes, racing tires and a full-width tail light, in silver", "l")
add("kaukaz-271-aras", "a squat utilitarian Soviet-style armored security van with a stubby cab, small slit windows and riveted plate, in orange and white municipal paint")
BR = "a huge brutalist Soviet-style cab-over heavy truck with a tall flat-faced cab, round headlights in a steel bumper, external air filters, exhaust stacks and six big wheels, "
fam(BR, kaukaz_bratsk_u4020="with a ribbed steel cargo box, in dark grey-green", kaukaz_bratsk_u4020_longbed="with an extra-long flatbed and a fourth axle, in dark grey-green",
    kaukaz_bratsk_u4020_zeya_u420_tow_rig="with a heavy tow crane on the back, in faded blue",
    kaukaz_bratsk_command_center="carrying a windowless armored box body with antennas, in dark grey")
add("kaukaz-zeya-u420", "a small brutalist Soviet-style cab-over truck with a boxy yellow cab, four big wheels and a blue steel dumpster on its flatbed")
add("kaukaz-grodno-e-80", "a boxy Soviet-style armored pickup truck with riveted plates, slit windows and a heavy machine gun on a ring mount in the bed, in olive drab")
COACH = "a long three-axle intercity bus with ribbed aluminium sides, a raked glass front and wraparound tinted windows, "
fam(COACH, mahir_mt28_coach="driverless, with advertising screens on its sides, in bare silver and blue",
    mahir_mt28_coach_badger_corporate="an armored executive coach in charcoal with dark tinted windows")
SUP = "a small tall rounded-box microvan in a 1980s kei style with a short snub nose, a sliding side door and tiny wheels, "
fam(SUP, mahir_supron_fs3="in cream with faded red side panels", mahir_supron_fs3_t="a passenger version in yellow with side windows",
    mahir_supron_barghest="in militia olive with bolted armor and mesh over the windows",
    mahir_supron_trailbruiser="lifted on big off-road tires with a ram plow, armor and a roof machine gun")
MAI = "a tiny tall wedge-shaped bubble microcar barely bigger than its seats, with a huge sloping glass canopy, a narrow track and tiny wheels, "
fam(MAI, makigai_maimai_e126="a four-seat plastic version in pastel pink", makigai_maimai_p126="a two-seat version in bright red")
TAN = "a tiny tall boxy Japanese kei 4x4 with an upright cab, round headlights, a winch bumper and oversized off-road tires, "
fam(TAN, makigai_tanishi_t400="in red", makigai_tanishi_kuma="lifted, in orange with a bull bar and roof lights")
BAS = "a massive hovering armored tank with no wheels and no tracks: a low, wide, flat angular hull floating on four glowing thrust skirts, sensor pods and slit viewports, "
fam(BAS, militech_basilisk_civilian="demilitarised with no gun and a rear cargo hold, in sand", militech_basilisk_military="with a flat turret and a long cannon, in olive",
    militech_basilisk_militech_internal="with a flat turret, a long cannon and extra armor, in matte black")
BEH = "a gigantic six-wheeled armored truck with a slanted wedge cab, slit windows, a long sleek armored box body and massive tires, "
fam(BEH, militech_behemoth="in matte black", militech_behemoth_transport="a faster armored transport in dark grey with a roof machine gun",
    militech_behemoth_mt_3="in dark grey with extra armor and an automated heavy machine gun turret on the roof",
    militech_behemoth_ui_9120_mobile_medical_unit="a mobile field hospital in white with green stripes, a ram plow and emergency lights")
add("militech-hellhound", "a six-wheeled armored assault car with a tall angular faceted body, slit windows, a ram bumper and a roof gunner hatch, in slate blue")
add("militech-missile-carrier", "an eight-wheeled military launcher truck with an armored cab and a big boxed missile launcher rack raised on its back, in olive")
add("mizutani-20xuf", "a featherweight mid-engined Japanese track car with an exposed tube frame, minimal body panels, a tiny windshield and a huge rear wing, in white and red")
HOZ = "a compact 1970s-style Japanese fastback coupe with a long hood, a louvred rear window, a ducktail and a full-width tail-light bar, "
fam(HOZ, mizutani_hozuki_hoseki="a two-seat sport version in jewel green", mizutani_hozuki_mh1="in pale silver-green", mizutani_hozuki_mh2="a sport trim in blue with a rear wing")
SH = ("a compact angular Japanese sports coupe with sharply creased origami-like body panels, razor-thin LED strip headlights, wide box fender flares, "
      "a solid panelled rear with no back window and a big rear diffuser, ")
fam(SH, mizutani_shion_mz1="in silver", mizutani_shion_mz2="in metallic teal-grey", mizutani_shion_targa_mzt="with an open targa top, in white",
    mizutani_shion_coyote="a desert nomad version: lifted, with an exposed tube frame, off-road tires, a spare wheel on the back and red-brown paint")
add("mizutani-shion-samum", "a wide armored four-door Japanese sports sedan with sharply creased body panels, razor-thin LED headlights, box fender flares and nitrous tanks, in sand")
add("porsche-911-turbo-930", "a classic 1970s German rear-engined sports coupe with round headlights on sloping front fenders, a curved roofline, wide rear arches and a big whale-tail spoiler, in dark silver")
R7 = "a 1980s-style two-door pony-car coupe with a long sloping hood, a pointed nose with a full-width light strip, a glass hatchback and a small rear spoiler, "
fam(R7, quadra_sport_r_7_540="in white", quadra_sport_r_7_580="in blue-violet with a tall rear wing", quadra_sport_r_7_charon="armored, in matte black with red trim and nitrous bottles",
    quadra_sport_r_7_vigilante="in dark grey with a push bar and a spotlight", quadra_sport_r_7_sterling_mr_hands_car="in gleaming sterling silver with mirror-black glass")
TR = ("a very low, wide, smooth-surfaced 1980s-style mid-engined wedge supercar: one clean unbroken hood sloping down to a thin sharp nose with two tiny slit pop-up headlight covers, "
      "a black horizontally-slatted bumper band across the full width of the nose that carries on as a black slatted strip along the bottom of the doors and across the flat cut-off tail, "
      "a row of slanted louvre slots in each front fender behind the wheel, a steeply raked wide windshield, frameless side glass with a triangular rear quarter window, "
      "a flat rear deck with a raised stepped engine cover between two buttresses, rear wheels bigger than the front ones, and flat polished solid disc wheels, ")
add("quadra-turbo-r-bigfoot-sasquatchs-cab", TR + "disguised as a taxi: orange-yellow paint with a black checkered band along its sides, a roof taxi light, "
    "racing tires, oversized turbo intakes and nitrous bottles showing through the rear engine cover", "l")
fam(TR, "l", quadra_turbo_r_740="in plain bright green", quadra_turbo_r_v_tech="in gloss black with thin gold pinstripes along its edges and a small rear wing",
    quadra_turbo_r_raijin="armored, in dark blue with twin machine guns in the nose")
T66 = ("a hulking two-door 1970s-style fastback muscle car with a very long hood, a blunt flat nose with a full-width recessed grille hiding the headlights, "
       "a louvred rear window and wide rear tires, ")
fam(T66, quadra_type_66_640_ts="in red with a silver side stripe", quadra_type_66_680_ts="in orange with black stripes", quadra_type_66_avenger="in white with twin blue stripes",
    quadra_type_66_javelina="a desert nomad version: lifted on off-road tires with a light bar, a spare wheel and orange-and-teal paint",
    quadra_type_66_reaver="a wasteland raider version in rusty black with mesh over the windows and welded scrap armor",
    quadra_type_66_wingate="lifted and armored in desert camouflage with off-road tires", quadra_type_66_bulitt_dinos_car="clean and classic in dark green",
    quadra_type_66_cthulhu_sampsons_car="in green-black with a giant exposed supercharger bursting through the hood and side exhaust pipes",
    quadra_type_66_mistral_rogues_car="sleek and armored in dark navy")
AER = ("a long art-deco ultra-luxury hyper-limousine with a tall upright nose of vertical chrome slats, a very long hood, big turbine-disc wheels "
       "and a smooth cabin with no visible windows, ")
fam(AER, "l", rayfield_aerondight_s9="in pearl white", rayfield_aerondight_2077_guinevere="in iridescent purple chrome")
CAL = "an ultra-low hypercar with a smooth rounded teardrop body, a bubble canopy blending into a long tail with no rear window, huge side intakes and a full-width light bar, "
fam(CAL, "l", rayfield_caliburn="in two-tone yellow and black", rayfield_caliburn_mordred_yorinobus_car="armored, in matte black with red accents")
add("rayfield-courtain", "a long smooth luxury lounge van with one big gullwing side door, wraparound mirrored windows and covered wheels, in pearl", "l")
add("rayfield-galatine", "a long formal six-seat luxury sedan with a seamless body, a mirrored glass roof and a tall nose of vertical chrome slats, in silver", "l")
add("rayfield-wygar", "an armored luxury coupe-SUV with a seamless muscular body, mirrored glass and large turbine-disc wheels, in midnight blue", "l")
COL = ("a 1970s-style three-door fastback hatch coupe with a long hood, a blunt flat nose with a full-width slatted grille hiding the headlights "
       "and louvred rear quarter windows, ")
fam(COL, thorton_colby_c125="in teal", thorton_colby_cst40="built as one longer estate car with a long roof and a rear hatch, in tan")
PK = "a small 1970s-style coupe-utility pickup with a long hood, a blunt flat nose with a full-width slatted grille, a short cab and an open bed, "
fam(PK, thorton_colby_cx140_butte="lifted on off-road tires, in pale olive", thorton_colby_barghest="in militia olive with bolted armor and a gun mount in the bed",
    thorton_colby_little_mule="a nomad version: lifted, dusty, with a roll bar and rally lights",
    thorton_colby_vulture="a nomad camper with a living shell on the bed, antennas, a satellite dish and water condensers",
    thorton_colby_revenant="a six-seat off-road muscle version: lifted, with a hood scoop, nitrous tanks and big tires, in black")
add("thorton-colby-c210-camper", "a boxy armored 1980s-style camper van with a pop-up roof, slit windows, reinforced tires and bolted armor, in cream and brown")
GAL = "a small rounded 1970s-style economy hatchback with round headlights, a short sloping tail, thin pillars and steel wheels, "
fam(GAL, thorton_galena_g240="in faded blue", thorton_galena_ga32t="a rally-sport trim in white with box flares and a spoiler",
    thorton_galena_gecko="a nomad off-road version in sand with a lift kit, a bull bar, a roof rack and spare fuel cans",
    thorton_galena_locust="an off-road version in green with a lift kit and mesh armor",
    thorton_galena_ghoul="rebuilt from scrap with mismatched rusty panels, welded armor and a ram plow",
    thorton_galena_the_rat="a tiny three-seat rear-engined version in grey primer")
MK = "a huge boxy slab-sided American crew-cab pickup truck with a tall flat grille, square stacked headlights, squared-off fender flares and chunky off-road tires, "
fam(MK, thorton_mackinaw_mtl1="in faded dark green with a roof light bar and a steel bull bar", thorton_mackinaw_larimore="a luxury trim in burgundy with chrome bumpers",
    thorton_mackinaw_warhorse="a nomad war rig with welded armor, a ram plow and a roof light bar, in dusty tan",
    thorton_mackinaw_mtl1_larimore_family_rig="a nomad family rig with a camper shell on the bed and gear strapped to the roof",
    thorton_mackinaw_beast="a racing monster in black with a giant tubular bull bar, an exposed engine and oversized tires",
    thorton_mackinaw_demiurge="a towering monster truck in gunmetal with gigantic tires, a ram bumper and heavy armor",
    thorton_mackinaw_saguaro="a desert rally version in sand with long-travel suspension, light pods and spare tires in the bed")
MER = "a huge six-wheeled boxy SUV with twin rear axles, flat faceted body panels, slim headlights and a blunt nose, "
fam(MER, thorton_merrimac_msl3="in bronze", thorton_merrimac_msp3_dreadnought="an armored interceptor " + NCPD + " and a ram plow")
add("ural-kombinat-am-773", "a colossal armored road train: a brutalist Soviet-style heavy truck with a ram plow pulling three armored container trailers, in dark green")
ALV = "a very long, low 1960s-American-style lowrider with six wheels on twin front axles, a huge chrome grille, a long hood and a formal roof, "
fam(ALV, villefort_alvarado_v4f_570_delegate="in silver with chrome trim", villefort_alvarado_v4fh_570_herman="a two-seat hot rod in candy purple with an exposed chrome engine")
VAN = "a boxy slab-sided cargo van with a short sloped nose, a tall slatted grille, a sliding side door and double rear doors, "
fam(VAN, villefort_columbus_family_star="a passenger version in beige with side windows", villefort_columbus_v340_f_delivery="a delivery van in white with a roof rack",
    villefort_columbus_v340_f_meatwagon_reo="an old armored cut-rate ambulance in dirty white with red and blue diagonal stripes, dented panels and a roof light bar", villefort_columbus_v340_f_freight="in plain grey-brown",
    villefort_columbus_v340_f_ncpd_tactical="an armored police tactical van " + NCPD + ", with mesh over the windows, a roof hatch and a ram bumper")
COR = "a formal boxy four-door 1980s-style executive sedan with a long hood, an upright rectangular grille, slim rectangular headlights and a squared trunk, "
fam(COR, villefort_cortes_v5000_valor="in dark blue", villefort_cortes_v6000_ncpd_overlord=NCPD,
    villefort_cortes_delamain_cab="a driverless luxury taxi in black with a white checkered stripe along its sides and cyan lights")
DEL = "a boxy 1980s-style two-door personal luxury coupe with a long hood, a formal upright roof, a slim full-width light strip and a short trunk, "
fam(DEL, villefort_deleon_v400_coup="in white", villefort_deleon_vindicator="a muscle version in black with a hood scoop and side exhaust pipes")
add("villefort-orellana-v-700", "a long six-seat 1970s-American-style station wagon with wood-grain side panels, a roof rack and a wide chrome grille")
SEM = "a low, curvaceous supercar in the style of a 1960s prototype racer, with voluptuous rounded fenders, a bubble canopy, a pointed nose and disc wheels, "
fam(SEM, "l", yaiba_arv_q340_semimaru="in deep red", mints_yaiba_semimaru="a racing custom in mint green and white with racing tires")

# Boats and submersibles (flag w: afloat). The setting's shipyards build like its carmakers: 1980s offshore-powerboat wedges, slab sides, louvres.
W = "w"
VUL = "a sleek 1980s-style offshore speedboat with a long, sharp, flat-decked wedge bow, a deep-V hull, a low cabin set far back and twin water-jet drives in a squared stern with louvred engine covers, "
CAT = "a broad, heavy armored speedboat with a wide, flat, blunt shovel bow like a catfish's head, slab sides of riveted armor plate, two long whip antennas sweeping back from the bow and twin water-jet drives, "
add("hydrosubsidium-bimac", "a chunky two-seat jetski with a sharp angular wedge nose, slab-sided faceted bodywork, motorcycle handlebars, a long bench saddle, a small machine gun fixed beside the nose "
    "and two nitrous bottles strapped at the stern, in gloss teal and white with an orange stripe", W)
add("hydrosubsidium-vulgaris", VUL + "the cabin under a smooth clear glass bubble dome with four seats inside, in mirror-glossy pearl white with a teal stripe along the hull", W + "l")
add("hydrosubsidium-vulgaris-triaina-patrol", VUL + "refitted as a patrol boat: a boxy armored wheelhouse with narrow slit windows in place of the cabin, a steel ram plate on the bow, "
    "two machine guns on pintle mounts on the foredeck and a searchlight, in grey-blue with a white diagonal stripe", W)
add("arasaka-hydrosubsidium-viper", "a very low, flat, stealth speedboat that can dive underwater: a faceted arrowhead hull of angular radar-deflecting panels with no rails and no deck fittings, "
    "a flush, low, dark tinted canopy, small dive planes at the bow and stern and twin shrouded water jets, in matte black with thin crimson-red trim lines", W + "l")
add("hydrosubsidium-dumbo", "a compact, rounded luxury cabin cruiser: a plump white hull with a big clear glass dome over a lounge, two broad rounded stabiliser fins standing out from its sides like ears, "
    "a small radar mast, and an open dive platform with a ladder at the stern, in gloss white with teal trim", W + "l")
add("zetatech-catfish", CAT + "with a fully enclosed cabin under a faceted armored-glass canopy with six seats, in mirror-glossy gunmetal grey with yellow hazard stripes at the bow", W)
add("zetatech-catfish-raider", CAT + "stripped down for raiding: an open cockpit with five bare seats and no windshield or glass at all, extra scrap armor plates welded to the sides "
    "and a boxy multi-tube rocket pod on a pintle mount at the stern, in rust-red primer and black", W)
add("zetatech-anguilla", "a long, slim, low armored luxury motor yacht shaped like an eel: a sharp reinforced steel ram bow, a long flush superstructure of dark tinted bulletproof windows, "
    "a clear glass dome over a sun lounge amidships, a swept radar arch and a squared stern, in mirror-glossy dark metallic blue-grey with chrome trim", W + "l")

# Powered armor (flag p: stands). The setting's suits are worn, not ridden: man-sized hydraulic exoskeletons under bolted plate, not giant robots.
P = "p"
PA = ("a suit of powered armor worn by one pilot sealed inside it, about two and a half metres tall with realistic human proportions: a small helmeted head sunk low between heavy shoulder pauldrons, "
      "a thick armored chest block, flat faceted armor plates bolted over a load-bearing exoskeleton frame, exposed hydraulic pistons and cable bundles at the hips, elbows and knees, "
      "heavy mechanical gauntlets and wide flat steel boots, a heavy industrial exoskeleton and not a giant robot; ")
add("arasaka-standard-c", PA + "this one is the slimmest and fastest of its kind, in matte black plates with crimson-red trim, a smooth featureless helmet with one thin horizontal red visor slit, "
    "small roller wheels built into its boots, a long slim rifle held in both gauntlets and a huge straight-bladed katana as long as the suit sheathed across its back", P + "l")
add("gunmart-mecha-special", PA + "this one is a cheap mass-market suit: thin, crudely welded, mismatched plates in bright yellow with red and blue panels, a boxy head with a mesh-guarded window instead of a helmet, "
    "visible weld seams and bolts, a drum-fed shotgun in one gauntlet, a stubby mortar tube on one shoulder and a small video screen strapped to its forearm", P)
add("hydrosubsidium-neo-gorgon", PA + "this one is a deep-sea diving suit: a rounded pressure-hull torso and a domed helmet with one thick round armored-glass port, in hi-vis orange and white with dark blue joints, "
    "two shrouded thruster pods on its back, floodlights and a camera on one shoulder, webbed swim-fin boots, one hand a cluster of tools and the other a three-pronged grapple claw on a winch cable", P)
add("militech-war-commando", PA + "this one is a blocky military war suit in olive drab and black with yellow chevron markings, a squat boxy helmet with a cluster of small round sensor lenses, "
    "a light machine gun with an underslung grenade launcher held in both gauntlets, a rocket launcher tube on one shoulder, a long sniper rifle slung across its back and whip antennas", P)
add("orbital-air-neo-spider", PA + "this one is a vacuum suit for fighting in orbit: smooth white and pale grey ceramic plates, a rounded helmet with a gold mirrored visor, a compact backpack of small thruster nozzles "
    "with more nozzles on its calves and forearms, two slim extra manipulator arms folded against the backpack, a short heavy pistol in each gauntlet and a short straight sword at its hip", P + "l")
add("sanroo-hello-cutie-pwr-up-bigsuit", PA + "this one is a cute toy-like suit: glossy rounded plates in pastel pink and white, a helmet with two cat ears and a big dark screen for a face showing two glowing pink heart-shaped eyes, "
    "paw-shaped gauntlets with short claws, a heart emblem on the chest, star and heart stickers, and a chunky pink toy-like submachine gun in one paw", P + "l")

# What a suit shows from straight overhead, for its token: the front view's faces, chest emblems and legs made the generator tilt the camera.
TOP = {
    "arasaka-standard-c": "slim matte black plates with crimson-red trim: a smooth black helmet dome, narrow angular shoulder pauldrons, a huge sheathed katana lying diagonally across its back, and a long slim rifle held in both gauntlets",
    "gunmart-mecha-special": "crudely welded mismatched plates in bright yellow with red and blue panels: a flat boxy yellow head-box with a mesh hatch on top, big square shoulder pauldrons, one red and one blue, "
                             "a stubby mortar tube on one shoulder, a small video screen on one forearm, and a drum-fed shotgun held in both gauntlets",
    "hydrosubsidium-neo-gorgon": "a rounded pressure hull in hi-vis orange and white with dark blue joints: a smooth domed helmet, round shoulder pauldrons, two shrouded thruster pods side by side on its back, "
                                 "a floodlight and camera on one shoulder, one forearm ending in a cluster of tools and the other in a three-pronged grapple claw",
    "militech-war-commando": "blocky olive drab and black plates with yellow chevron markings on the pauldrons: a squat boxy helmet, wide slab shoulder pauldrons, a rocket launcher tube on one shoulder, "
                             "a long sniper rifle slung across its back, two whip antennas, and a light machine gun with an underslung grenade launcher held in both gauntlets",
    "orbital-air-neo-spider": "smooth white and pale grey ceramic plates: a rounded white helmet, rounded shoulder pauldrons, a compact backpack studded with small thruster nozzles, "
                              "two slim extra manipulator arms folded flat against the backpack, and a short heavy pistol in each gauntlet",
    "sanroo-hello-cutie-pwr-up-bigsuit": "glossy rounded plates in pastel pink and white: a round pink helmet with two cat ears, big round shoulder pauldrons with a heart on one and a star on the other, "
                                         "a small white backpack with a heart on it, pink paw-shaped gauntlets, and a chunky pink toy-like submachine gun held in both paws",
}


ROUGH = "Retro-futuristic 2070s megacity design: chunky bolted panels, exposed hardware, worn paint."
LUX = "Retro-futuristic 2070s megacity design: flawless paint, seamless panels, expensive."
KURT = ("Square tabletop RPG token art: waist-up portrait of a towering, muscular, bald mercenary warlord with realistic proportions, a small head on a thick neck and very broad shoulders, in his fifties with a clean-shaven hard weathered face, pale grey eyes, "
        "thin cyberware seams on his cheeks and a heavy cybernetic port at the back of his neck, wearing a plain black v-neck t-shirt, a brown leather shoulder harness with a chest pouch "
        "and a combat knife sheathed on the strap, and dog tags; one arm is an olive-green and black military cyberarm, the other forearm is covered in hexagon-pattern armor plating. "
        "Stern stare, centered, plain near-black background, magenta and cyan neon rim light. Gritty painted comic-book art, bold ink lines, cel shading, cyberpunk. No text, logos or frame.")


def sheet(s, f):
    if "p" in f:
        return (f"Powered armor illustration: {s}. {LUX if 'l' in f else ROUGH} Three-quarter front view, the whole suit from helmet to boots in frame, standing upright in a ready stance on dark wet asphalt, "
                "black background, magenta and cyan neon rim light. Gritty painted comic-book art, bold ink lines, cel shading. One suit only, no other people, no text, logos or frame.")
    pose = "afloat on calm black water at night" if "w" in f else "hovering just above the ground" if "a" in f else "parked on its stand on dark wet asphalt" if "b" in f else "parked on dark wet asphalt"
    return (f"Vehicle illustration: {s}. {LUX if 'l' in f else ROUGH} Three-quarter front view, whole vehicle in frame, {pose}, black background, "
            "magenta and cyan neon rim light. Gritty painted comic-book art, bold ink lines, cel shading. No rider, no people, no text, logos, plates or frame.")


def td(s, f, k=None):
    if "p" in f:
        return (f"Top-down token for a tabletop RPG battle map: one suit of man-sized powered armor seen from directly above in a straight overhead bird's-eye view, the camera looking straight down on the top of its helmet, "
                f"{TOP[k]}. {LUX if 'l' in f else ROUGH} The suit faces the top of the image with its back toward the bottom, both arms reaching forward toward the top of the image "
                "and the weapon's muzzle pointing at the top edge. Only the crown of the helmet, the tops of the shoulders, the backpack, the tops of the forearms and the weapon can be seen; "
                "the face, the visor, the chest and the legs are hidden underneath and are not visible at all. Centered, filling most of the square frame, on a plain flat pure white background, no shadow, no ground. "
                "Gritty painted comic-book art, bold black ink outline around the whole figure, cel shading, small magenta and cyan accent lights. One suit only, no text, logos or frame.")
    return (f"Top-down battle-map token: {s}. {LUX if 'l' in f else ROUGH} Seen from directly above in a straight overhead view, looking down on the top of its helmet and its broad shoulder pauldrons, "
                "its arms and weapon held out in front of it toward the top of the image, facing toward the top, centered, filling most of the square frame, on a plain flat pure white background, no shadow, no ground. "
                "Gritty painted comic-book art, bold black ink outline around the whole figure, cel shading, small magenta and cyan accent lights. One suit only, no text, logos or frame.")
    return (f"Top-down battle-map token: {s}. {LUX if 'l' in f else ROUGH} Seen from directly above, straight overhead, nose pointing up, centered, filling the square frame, "
            "on a plain flat pure white background, no shadow, no ground. Gritty painted comic-book art, bold black ink outline, cel shading, small magenta and cyan accent lights. "
            "No rider, no people, no text, logos, plates or frame.")


def prompts():
    out = []
    for k, (s, f) in D.items():
        out.append(("v2:" + k, sheet(s, f)))
        out.append(("v2td:" + k, td(s, f, k)))
    out.append(("v2:kurt-hansen", KURT))
    return out


if __name__ == "__main__":
    json.dump(prompts(), sys.stdout)
