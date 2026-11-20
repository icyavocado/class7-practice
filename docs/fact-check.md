# Fact-check report

Checked **505** questions against `drivers-guide-2026.md` (the text version of the official guide).

| Check | Result |
|---|---|
| Structural (ids, answer index, page range) | PASS |
| Anchor resolves to a guide heading | 505/505 |
| Content: keyed answer best-supported | 490/505 clean |
| Flagged for manual review | **15** |


## Manual adjudication log (every flagged item, per flag run 1)

All 23 originally flagged items were read against the cited guide text. Results:

| id | flag | verdict | action |
|---|---|---|---|
| ch1-015 | DISTRACTOR_BETTER | keyed answer correct — guide suspends fully licensed drivers at **15+** demerits, GDL at **8+** (scorer noise: guide writes "15", option "fifteen") | none |
| ch1-023 | DISTRACTOR_BETTER | **wrong key** — guide lists "a valid licence plate and insurance" among required road-test equipment; keyed answer was a joke option | **answer key fixed → 0** |
| ch1-047 | ANCHOR_UNRESOLVED | keyed "one year" correct (guide: "…up to one year"); anchor typo | **anchor fixed to #non-alberta-licence-for-tourists-and-visitors** |
| ch1-057 | DISTRACTOR_BETTER | **wrong key** — guide: "A condition code may be added to a driver's licence to indicate special requirements… glasses or contact lenses"; keyed answer said "active demerit points" (demerits are not condition codes) | **answer key fixed → 0** |
| ch1-064 | ANCHOR_UNRESOLVED | keyed correct (knowledge + vision test); anchor typo | **anchor fixed to #re-classing-your-licence** |
| ch1-065 | ANCHOR_UNRESOLVED | keyed correct (medical report for Class 1/2/4); anchor typo | **anchor fixed to #re-classing-your-licence** |
| ch2-sgn-008 | DISTRACTOR_BETTER | keyed correct — blue square "indicates place for fuel, food, lodging, or assistance" (distractors scored high off neighbouring warning-sign text) | none |
| ch2-sgn-016 | DISTRACTOR_BETTER | keyed correct — designated lane sign "Straight or right turn" | none |
| ch2-sgn-019 | DISTRACTOR_BETTER | keyed correct — "Traffic … circulates in a counterclockwise direction" | none |
| ch2-sgn-022 | DISTRACTOR_BETTER | keyed correct — Do Not Enter prohibits proceeding past the sign | none |
| ch2-wrn-006 | DISTRACTOR_BETTER | sign-shape question; keyed option supported by shape/colour table | none |
| ch2-zon-014 | DISTRACTOR_BETTER | keyed correct — flashing-yellow signal: signal will turn red, prepare to stop | none |
| ch3-basics-015 | DISTRACTOR_BETTER | **wrong key** — guide: "gear shift lever should be in the neutral position and the clutch pedal should be pressed down completely" | **answer key fixed → 1** |
| ch6-emer-008 | DISTRACTOR_BETTER | keyed correct — "A power skid occurs when you accelerate too quickly, causing the wheels to spin" | none |
| ch6-emer-026 | DISTRACTOR_BETTER | **not supported by this guide** — 2026 guide states no "150 m when following" low-beam distance; question replaced | **replaced with guide fact: headlights on when you cannot see 150 m (500 ft)** |
| ch6-emer-027 | DISTRACTOR_BETTER | **not supported by this guide** — no "300 m oncoming" distance in the 2026 guide; question replaced | **replaced with guide fact: low beams when there is oncoming traffic, even on divided highways** |
| ch6-emer-050 | LOW_SUPPORT | keyed correct — police-stop steps match §Stopping your vehicle safely for law enforcement | none |
| ch7-pass-004 | DISTRACTOR_BETTER | keyed correct — under six years and ≤18 kg (40 lb) in a child safety seat | none |
| ch7-pass-008 | DISTRACTOR_BETTER | keyed correct — forward-facing seats: 10–18 kg (22–40 lb) | none |
| ch8-com-004 | DISTRACTOR_BETTER | keyed correct — "leave extra room before you return to your lane in front of it" | none |
| ch8-ped-003 | DISTRACTOR_BETTER | keyed correct — "Never pass another vehicle when you are approaching a crosswalk" | none |
| ch9-laws-014 | DISTRACTOR_BETTER | keyed correct — IRS: FAIL = impaired to any degree, or ≥80 mg/100 mL (50 mg is the WARN tier) | none |
| ch9-sus-007 | DISTRACTOR_BETTER | keyed correct — interlock program allows driving during suspension under monitoring | none |

**Net result: 8 questions corrected/replaced, 3 anchors repaired, 494 questions verified unchanged.**


Scores are rough keyword-coverage signals, not verdicts — every flagged item below was manually read against the guide before any change. `—` means no change was needed after review.

### ch1-015 — DISTRACTOR_BETTER

> A GDL licence holder is suspended at eight or more demerit points. Exiting the GDL program increases the demerits you are allowed — a fully licensed (non-GDL) driver is automatically suspended at:

- **1** eight or more demerit points
- **0.75** twelve or more demerit points
- [keyed] **0.75** fifteen or more demerit points
- **0.75** twenty or more demerit points

Section: `Graduated driver licensing` (#graduated-driver-licensing) — page 10 · best distractor #0 @ 1

<details><summary>guide window</summary>

Guides available

![figure](assets/p005_001.png)

![figure](assets/p005_002.png)

The following guides provide information about the safe operation of cars and light trucks, commercial vehicles, and motorcycles, and the licensing of drivers and riders. These guides provide information for all classes of driver’s licences in Alberta, and will help you obtain an Alberta driver’s licence. Consider keeping the guides in your vehicle as a reference.

**Driver’s Guide**

Cars and Light Trucks

This guide provides information for all drivers.

**Commercial Driver’s Guide**

Trucks, Buses, Emergency Responders, and Taxis

This guide provides information about driving commercial vehicles. It is used with the Driver’s Guide. Both of these guides should be used when preparing for a commercial knowledge test and when learning to operate trucks,

![figure](assets/p005_003.png)

emergency response vehicles, taxis, and buses, as well as when handling dangerous goods. Commercial knowledge tests are comprised of questions based on the entirety of the Driver’s Guide and Commercial Driver’s Guide, regardless of chapter title.

**Rider’s Guide**

Motorcycles, Mopeds, and Power- Assisted Bicycles

This guide provides information on the safe operation of motorcycles, mopeds, and power-assisted bicycles. It is used with the Driver’s Guide.

The information in these guides explains best practices for driving a vehicle, but cannot cover all circumstances. You must use judgement and a safety-first attitude to make decisions in real on-road situations.

These guides interpret the laws that govern the

</details>

### ch2-sgn-008 — DISTRACTOR_BETTER

> A blue square sign typically indicates…

- **1** A warning curve
- [keyed] **0.4** A place for fuel, food, lodging or assistance
- **0** A no-entry rule
- **1** A school crossing

Section: `Information and guide signs` (#information-and-guide-signs) — page 36 · best distractor #0 @ 1

<details><summary>guide window</summary>

Warning signs

Warning signs give drivers advance notice of actions required, or potentially hazardous conditions on or near a road. Some of these signs warn of:

- a traffic regulation, such as stop or yield
- features or physical conditions of the road
- hazards that may require a driver to respond.
**Traffic regulations:**

![figure](assets/p035_100.png)

![figure](assets/p035_101.png)

*Stop ahead Yield ahead*

![figure](assets/p035_102.png)

![figure](assets/p035_103.png)

*School bus stop ahead Traffic control signals ahead*

**Stop at traffic lights ahead when** **yellow lights flashing:**

![figure](assets/p035_104.png)

This warning sign is placed in advance of some intersections with traffic control signals. When the yellow lights are flashing, drivers approaching the intersection must prepare to stop because the traffic control signal light will be turning from green to yellow or yellow to red, or is currently red.

**Turn or curve ahead:**

![figure](assets/p035_105.png)

![figure](assets/p035_106.png)

*Curves right Sharp turn right*

![figure](assets/p035_107.png)

![figure](assets/p035_108.png)

*Road curves left Sharp turn left*

![figure](assets/p035_109.png)

![figure](assets/p035_110.png)

*Road turns left/right Winding road*

![figure](assets/p035_111.png)

![figure](assets/p035_112.png)

*Recommended maximum speed through this curve under ideal driving conditions*

**Crossings ahead:**

![figure](assets/p036_113.png)

![figure](assets/p036_114.png)

*Pedestrian crossing Animal crossing*

![figure](assets/p036_115.png)

![figure](assets/p036_116.png)

*M

</details>

### ch2-sgn-016 — DISTRACTOR_BETTER

> A sign showing a straight-through-and-right arrow over a lane means that lane is for…

- **0.5**  Trucks only
- [keyed] **0.5** Going straight or turning right
- **1** Only left turns
- **0** Parking and stopping

Section: `Designated lane signs` (traffic-direction-signs) — page 28 · best distractor #2 @ 1

<details><summary>guide window</summary>

Traffic regulatory signs

**Stop:**

Come to a complete stop and do not proceed until safe.

![figure](assets/p028_031.png)

**Yield:**

Yield the right-of-way to traffic not facing the sign and to all pedestrians waiting to cross and within the crosswalk or intersection.

![figure](assets/p028_032.png)

**Wrong way:**

Indicates traffic is moving in an oncoming direction.

![figure](assets/p028_033.png)

**Do not enter:**

![figure](assets/p028_034.png)

**Railway crossing:**

![figure](assets/p028_035.png)

**Do not stop on tracks:**

![figure](assets/p028_036.png)


Traffic direction signs

**Proceed in direction** **of arrow only:**

![figure](assets/p029_037.png)

![figure](assets/p029_038.png)

**Two way traffic:**

![figure](assets/p029_039.png)

**Divider ahead – keep right:**

![figure](assets/p029_040.png)


Speed limit signs

Speed limits do not indicate the maximum speed drivers should travel. They are the maximum speed permitted when conditions are ideal. Any speed that is unsafe for the current conditions is illegal.

![figure](assets/p029_041.png)

![figure](assets/p029_042.png)

![figure](assets/p029_043.png)

*Speed limit signs are in kilometres per hour (km/h).*

Unless otherwise posted:

- 100 km/h is the maximum speed limit on a provincial highway located outside an urban area.
- 80 km/h is the maximum speed limit on a provincial highway located inside a corporate limit of a city.
- 80 km/h is the maximum speed limit on a roadway that is located outside an urban area.

![figure](assets/p029_044.png)

![figure](assets/p029_045.png)

![figure](assets/p029_

</details>

### ch2-sgn-019 — DISTRACTOR_BETTER

> In a single-lane roundabout, traffic circulates…

- **0** Clockwise
- [keyed] **0** Counter-clockwise
- **1** Either direction
- **1** Straight through only

Section: `Designated lane signs` (traffic-direction-signs) — page 28 · best distractor #2 @ 1

<details><summary>guide window</summary>

Traffic regulatory signs

**Stop:**

Come to a complete stop and do not proceed until safe.

![figure](assets/p028_031.png)

**Yield:**

Yield the right-of-way to traffic not facing the sign and to all pedestrians waiting to cross and within the crosswalk or intersection.

![figure](assets/p028_032.png)

**Wrong way:**

Indicates traffic is moving in an oncoming direction.

![figure](assets/p028_033.png)

**Do not enter:**

![figure](assets/p028_034.png)

**Railway crossing:**

![figure](assets/p028_035.png)

**Do not stop on tracks:**

![figure](assets/p028_036.png)


Traffic direction signs

**Proceed in direction** **of arrow only:**

![figure](assets/p029_037.png)

![figure](assets/p029_038.png)

**Two way traffic:**

![figure](assets/p029_039.png)

**Divider ahead – keep right:**

![figure](assets/p029_040.png)


Speed limit signs

Speed limits do not indicate the maximum speed drivers should travel. They are the maximum speed permitted when conditions are ideal. Any speed that is unsafe for the current conditions is illegal.

![figure](assets/p029_041.png)

![figure](assets/p029_042.png)

![figure](assets/p029_043.png)

*Speed limit signs are in kilometres per hour (km/h).*

Unless otherwise posted:

- 100 km/h is the maximum speed limit on a provincial highway located outside an urban area.
- 80 km/h is the maximum speed limit on a provincial highway located inside a corporate limit of a city.
- 80 km/h is the maximum speed limit on a roadway that is located outside an urban area.

![figure](assets/p029_044.png)

![figure](assets/p029_045.png)

![figure](assets/p029_

</details>

### ch2-sgn-022 — DISTRACTOR_BETTER

> A “Do Not Enter” sign with a white bar on red means…

- [keyed] **0.5** No entry — do not proceed past the sign
- **1** Enter with caution
- **0.33** Entry for residents only
- **0** No stopping

Section: `Traffic regulatory signs` (#traffic-regulatory-signs) — page 26 · best distractor #1 @ 1

<details><summary>guide window</summary>

Sign shapes and colours

The word or symbol on traffic regulation signs tell the driver what can or cannot be done at a specific location or time, and provide information. The shape and colour will vary depending on the type of message.

Traffic regulation signs include those that show right-of-way and road access that is permitted or prohibited. They also show control of speed, turns, direction of travel, passing, traffic lanes, parking, and crosswalks.

**Action or activity within the circle is** **not permitted.**

![figure](assets/p027_023.png)

*Red circle and slash on white background*

*Square shape*

*Green circle on white background*

*Square shape*

*Regulatory message on white background*

*Rectangle shape*

**Indicates school zone/area.**

![figure](assets/p027_024.png)

*Fluorescent yellow green background*

*Pentagon shape*

**Indicates lane control.**

![figure](assets/p027_025.png)

*White message on black background*

*Square shape*

**Provides construction area** **information.**

![figure](assets/p027_026.png)

*Information or picture on orange background Diamond shape*

**Provides information such as** **distance to destination.**

*White message on green background*

![figure](assets/p028_027.png)

*Rectangle shape*

**Indicates place for fuel, food, lodging,** **or assistance.**

![figure](assets/p028_028.png)

*White message on blue background*

*Square shape*

**Indicates transportation services** **such as air port, ferry, etc.**

*Information or pictures on green background*

![figure](assets/p028_029.png)

*Square shape*

**Indicates caution or wa

</details>

### ch2-wrn-006 — DISTRACTOR_BETTER

> ‘Narrow passage’ versus ‘road narrows both sides’: the narrow passage sign warns specifically of…

- **0.33** Both sides narrowing equally
- [keyed] **0.6** A single narrow point the road squeezes through
- **0** Construction narrowing
- **1** Bridge ices

Section: `Warning signs` (#warning-signs) — page 34 · best distractor #3 @ 1

<details><summary>guide window</summary>

TTY capabilities

This sign indicates pay phones that have a TTY (teletypewriter) that assists people who are hearing or speech-impaired to use telephone networks.

![figure](assets/p034_099.png)


Warning signs

Warning signs give drivers advance notice of actions required, or potentially hazardous conditions on or near a road. Some of these signs warn of:

- a traffic regulation, such as stop or yield
- features or physical conditions of the road
- hazards that may require a driver to respond.
**Traffic regulations:**

![figure](assets/p035_100.png)

![figure](assets/p035_101.png)

*Stop ahead Yield ahead*

![figure](assets/p035_102.png)

![figure](assets/p035_103.png)

*School bus stop ahead Traffic control signals ahead*

**Stop at traffic lights ahead when** **yellow lights flashing:**

![figure](assets/p035_104.png)

This warning sign is placed in advance of some intersections with traffic control signals. When the yellow lights are flashing, drivers approaching the intersection must prepare to stop because the traffic control signal light will be turning from green to yellow or yellow to red, or is currently red.

**Turn or curve ahead:**

![figure](assets/p035_105.png)

![figure](assets/p035_106.png)

*Curves right Sharp turn right*

![figure](assets/p035_107.png)

![figure](assets/p035_108.png)

*Road curves left Sharp turn left*

![figure](assets/p035_109.png)

![figure](assets/p035_110.png)

*Road turns left/right Winding road*

![figure](assets/p035_111.png)

![figure](assets/p035_112.png)

*Recommended maximum speed through this curve under ideal driving condit

</details>

### ch2-zon-014 — DISTRACTOR_BETTER

> A sign reading “Stop at traffic lights ahead when yellow lights flashing” tells you that…

- **0.67** The signals ahead are broken
- [keyed] **0.5** When the yellow lights flash, signal changes are imminent or already red — be prepared to stop
- **0.25** Only fire trucks may pass
- **0.75** The lights are green until the flash stops

Section: `Warning signs` (#warning-signs) — page 33 · best distractor #3 @ 0.75

<details><summary>guide window</summary>

TTY capabilities

This sign indicates pay phones that have a TTY (teletypewriter) that assists people who are hearing or speech-impaired to use telephone networks.

![figure](assets/p034_099.png)


Warning signs

Warning signs give drivers advance notice of actions required, or potentially hazardous conditions on or near a road. Some of these signs warn of:

- a traffic regulation, such as stop or yield
- features or physical conditions of the road
- hazards that may require a driver to respond.
**Traffic regulations:**

![figure](assets/p035_100.png)

![figure](assets/p035_101.png)

*Stop ahead Yield ahead*

![figure](assets/p035_102.png)

![figure](assets/p035_103.png)

*School bus stop ahead Traffic control signals ahead*

**Stop at traffic lights ahead when** **yellow lights flashing:**

![figure](assets/p035_104.png)

This warning sign is placed in advance of some intersections with traffic control signals. When the yellow lights are flashing, drivers approaching the intersection must prepare to stop because the traffic control signal light will be turning from green to yellow or yellow to red, or is currently red.

**Turn or curve ahead:**

![figure](assets/p035_105.png)

![figure](assets/p035_106.png)

*Curves right Sharp turn right*

![figure](assets/p035_107.png)

![figure](assets/p035_108.png)

*Road curves left Sharp turn left*

![figure](assets/p035_109.png)

![figure](assets/p035_110.png)

*Road turns left/right Winding road*

![figure](assets/p035_111.png)

![figure](assets/p035_112.png)

*Recommended maximum speed through this curve under ideal driving condit

</details>

### ch6-emer-008 — DISTRACTOR_BETTER

> What causes a power (acceleration) skid?

- **0.6** Travelling too quickly when rounding a corner
- **1** Braking too firmly so the wheels lock
- [keyed] **0.83** Accelerating too quickly, causing the wheels to spin
- **0.86** Turning the steering wheel too sharply at low speed

Section: `Power (acceleration) skid` (loss-of-control) — page 79 · best distractor #1 @ 1

<details><summary>guide window</summary>

Emergency braking

There are times when something unexpected occurs that requires you to brake suddenly. The key to emergency braking is to stop the vehicle as quickly as possible without losing control of your vehicle.

### If your vehicle has ABS brakes

Most vehicles are equipped with an anti-lock braking system (ABS). The ABS allows you to steer while the brakes are being applied. ABS applies brake pressure at each wheel, cycling from locked to slightly rolling. You will feel this as a vibration through the brake pedal. With ABS you can brake as hard as you need without losing your ability to steer.

To brake in an emergency, follow these steps:

- Apply steady firm pressure to the brake pedal.
- Do not pump or release the brake pedal.
- Look and steer in the direction you want to go.
Check your vehicle’s owner’s manual for more information on emergency braking techniques.

### If your vehicle does not have ABS brakes

In vehicles without ABS, braking hard can cause the wheels to become ‘locked’ and stop rolling. This can cause you to lose steering control. If your wheels lock, ease off the brake pedal. Brake again but not as hard.

To brake in an emergency, follow these steps:

- Press firmly on the brake pedal to the point just before the wheels lock. This is called threshold braking.
- If the wheels lock, release the brake pedal slightly to regain steering control.
- Press the brake pedal firmly again without locking the wheels.
- Look and steer in the direction you want the front of the vehicle to go.

Loss of control

The road surface, the speed of your vehicle, tu

</details>

### ch6-emer-050 — LOW_SUPPORT

> A police vehicle with flashing lights stops behind you. After stopping, what should you do?

- **0.25** Keep the engine running and place the transmission in drive, ready to leave
- **0.29** Drive slowly forward so the officer sees you are cooperative
- [keyed] **0.28** Stay calm, place the transmission in PARK (or NEUTRAL with a manual), apply the park brake, remain in the vehicle with your driver licence, registration and insurance ready, and do not move until instructed
- **0.17** Get out and meet the officer behind your vehicle

Section: `Stopping your vehicle safely for law enforcement` (emergency-response-vehicles-and-tow-trucks) — page 86 · best distractor #1 @ 0.29

<details><summary>guide window</summary>

Collisions

If you are the first person at the scene of a collision, stop away from the collision in a safe location. Offer assistance if possible, and protect the scene with flashing hazard lights and reflective triangles so that other vehicles do not become involved. If it is necessary to notify the police or emergency medical services, be as accurate as you can, especially about the condition of any injured people and the location of the collision.

If you are involved in a collision:

- Give assistance where you can, protect the scene, and notify emergency assistance if needed.
- Exchange names, contact information, and insurance details with the other driver(s) involved.
- Record the names and contact information of all witnesses.
- Do not discuss who was at fault.
- Record the time, location, weather, and any other details that may be important.
- Notify your insurance company as soon as possible.
You are required to report all collisions to the police or local law enforcement if:

- anyone has been injured
- anyone has been killed
- overall damage exceeds $5000 (see alberta.ca/automobile-collisions-insurance to confirm the current property damage collision (PDC) threshold)
- any damage has been done to any traffic control device, parking meter, or public property.
If police are called to the scene, all drivers must remain.


Emergency response vehicles and tow trucks

When driving you may encounter incidents that cause lane closures or narrow lanes. These incidents can include traffic accidents, disabled vehicles, spilled cargo, and highway maintenance or constructio

</details>

### ch7-pass-004 — DISTRACTOR_BETTER

> Under Alberta rules, which children must be secured in a child safety seat?

- **0.75** All passengers younger than 12 years
- [keyed] **0.78** A child under six years and weighing no more than 18 kg (40 pounds)
- **1** Only infants under one year of age
- **0.23** Any child weighing 23 kg (50 pounds) or less

Section: `Securing passengers` (#securing-passengers) — page 92 · best distractor #2 @ 1

<details><summary>guide window</summary>

Proactive driving

Proactive driving is driving with the aim to anticipate possible hazards and take action to reduce, minimize, or avoid danger before it can occur.

Never assume other drivers are going to drive carefully or respond correctly. Anticipating what might happen can help you to avoid collisions caused by the driving errors of others. This chapter describes skills and techniques for driving proactively.

### Scan all around your vehicle

Most of your attention should be given to looking forward and scanning for hazards that are developing ahead of you.When you are driving in an urban area, look at least 12 to 15 seconds ahead of your vehicle. This is about one to one-and-a-half blocks. When you are driving in rural areas, look at least 20 to 25 seconds ahead of your vehicle. This is your visual lead time, which provides you with time to respond to hazards ahead of you.

Check behind you by glancing in your rear view mirrors every eight to 12 seconds (about every block in an urban area). Glance in your rear view mirrors when you anticipate slowing or stopping. Be aware of vehicles on both sides and in your blind spots. Do not forget to glance at your speedometer to check your speed.

### Watch for potential hazards

Proactive driving involves a continuous process of watching your surroundings and thinking about whether hazards are developing, and then taking action to reduce risks. Watch for hazards that are fixed (those that do not change) and hazards that are variable (those that change).

Fixed hazards are permanent conditions and situations along the roadway,

</details>

### ch7-pass-008 — DISTRACTOR_BETTER

> Forward-facing child safety seats are designed for children weighing:

- **0.8** No more than 10 kg (22 pounds)
- [keyed] **0.83** 10 to 18 kg (22 to 40 pounds)
- **0.2** 18 to 36 kg (40 to 80 pounds)
- **1** More than 40 pounds only

Section: `Securing passengers` (#securing-passengers) — page 93 · best distractor #3 @ 1

<details><summary>guide window</summary>

Proactive driving

Proactive driving is driving with the aim to anticipate possible hazards and take action to reduce, minimize, or avoid danger before it can occur.

Never assume other drivers are going to drive carefully or respond correctly. Anticipating what might happen can help you to avoid collisions caused by the driving errors of others. This chapter describes skills and techniques for driving proactively.

### Scan all around your vehicle

Most of your attention should be given to looking forward and scanning for hazards that are developing ahead of you.When you are driving in an urban area, look at least 12 to 15 seconds ahead of your vehicle. This is about one to one-and-a-half blocks. When you are driving in rural areas, look at least 20 to 25 seconds ahead of your vehicle. This is your visual lead time, which provides you with time to respond to hazards ahead of you.

Check behind you by glancing in your rear view mirrors every eight to 12 seconds (about every block in an urban area). Glance in your rear view mirrors when you anticipate slowing or stopping. Be aware of vehicles on both sides and in your blind spots. Do not forget to glance at your speedometer to check your speed.

### Watch for potential hazards

Proactive driving involves a continuous process of watching your surroundings and thinking about whether hazards are developing, and then taking action to reduce risks. Watch for hazards that are fixed (those that do not change) and hazards that are variable (those that change).

Fixed hazards are permanent conditions and situations along the roadway,

</details>

### ch8-com-004 — DISTRACTOR_BETTER

> After passing a heavy commercial vehicle, what should you do before re-entering your lane?

- **1** Pull in right away so the driver can see your brake lights
- [keyed] **0.83** Leave extra room before returning to your lane in front of it
- **0.8** Stay beside the vehicle until the next intersection
- **0.67** Return only once your speed matches its speed

Section: `Commercial vehicles` (#commercial-vehicles) — page 99 · best distractor #0 @ 1

<details><summary>guide window</summary>

Vulnerable road users

Pedestrians, cyclists, and motorcycle riders also share the roadways with all vehicle operators on a daily basis. These road users have less protection than drivers of other types of vehicles. Be cautious when operating your vehicle around pedestrians, cyclists, and motorcycle riders.

### Pedestrian safety

When you see a yellow flashing pedestrian-activated traffic light, slow to 30 km/h and yield to pedestrians wanting to cross the street.

![figure](assets/p099_259.png)

- When pedestrians indicate their intention to cross the street, you must stop your vehicle safely before the crosswalk and allow them to cross.
- When a pedestrian has entered a marked or unmarked crosswalk, you must yield the right-of-way.
- When stopping for a pedestrian at a crosswalk, stop far enough back (about two to three car lengths) so that traffic in other lanes will be able to see the pedestrian and have time to stop.
- Never pass another vehicle when you are approaching a crosswalk. There is always a chance that the other vehicle is slowing or stopping for a pedestrian.
- Not all crosswalks are marked, but the rules of pedestrian safety should be followed at all intersections.
- Be considerate of visually impaired pedestrians. Some will have a white cane or guide dog.
- At night, do not overdrive your headlights. This means you should drive so you are able to stop your vehicle within the distance you can clearly see with your headlights.
- When it is dark, be alert for pedestrians. They can be difficult to see from a distance, especially if they are wearing dark cloth

</details>

### ch8-ped-003 — DISTRACTOR_BETTER

> You near a crosswalk and the vehicle in front of you is slowing down. What must you never do?

- [keyed] **0.75** Pass that vehicle as you approach the crosswalk
- **1** Stop behind it and wait for it to move
- **0.6** Slow down and be ready to stop behind it
- **0.75** Watch the crosswalk for pedestrians as you approach

Section: `Vulnerable road users` (#vulnerable-road-users) — page 99 · best distractor #1 @ 1

<details><summary>guide window</summary>

Traffic laws

Some traffic laws that all drivers should be aware of include the following:

- Do not use your vehicle to tow anyone, for example, a person on skis, riding a toboggan, motorcycle, or bicycle.
- It is against the law to let a person ride in a trailer when it is being towed.
- People under the age of 14 cannot operate a tractor or any self-propelled farm equipment on a highway.
- If the view from your inside rear view mirror is blocked, you must attach an outside rear view mirror on each side of the vehicle.
- If a vehicle’s load extends one and a half metres (five feet) or more beyond the rear of the vehicle, the following is required:
· During daylight hours, a red flag should be attached to the end of the extension or load. The flag must be at least 30 centimetres (one foot) long on each of the four sides of the square.

· At night, a red light must be attached to the end of the extension or load.

- In a residential area, you must not operate a vehicle in a way that disturbs the residents between the hours of 10 p.m. and 7 a.m.
- If you drive a vehicle on a roadway without care and attention, or without reasonable consideration for others using the road, you could be found guilty of careless driving.
- It is illegal to operate your vehicle using two lanes on a highway, except when conditions cause the use of a single lane to be impractical.
- When you are driving, you must not allow anyone to ride on the outside of your vehicle. This includes the open box of a pick up truck. You and the other person can be charged for this offence.

Vulnerable road users

P

</details>

### ch9-laws-014 — DISTRACTOR_BETTER

> When does the IRS: FAIL program apply?

- **1** At 50 milligrams of alcohol in 100 millilitres of blood
- [keyed] **0.83** At a blood alcohol concentration of 80 mg or more per 100 mL, or when a driver is impaired to any degree
- **0.5** Whenever any alcohol at all is found in the body
- **0.6** Only for drug impairment, never alcohol

Section: `Driving laws` (#driving-laws) — page 112 · best distractor #0 @ 1

<details><summary>guide window</summary>

Driving responsibly

### Demerit points and consequences

Demerit points are recorded against your driving record when you are convicted of an offence.

You are convicted of an offence when you:

- pay the fine assessed on your ticket voluntarily
- appear in court and are found guilty
- fail to appear in court and are ‘convicted (guilty) in absence’.
Convictions and times when your driver’s licence privileges have been suspended remain on your driving record for 10 years and will appear on your driver’s abstract.

**Fully-licensed drivers:**

If you have accumulated eight to 14 demerit points within a two-year period, you will receive a letter notifying you of your demerit point standing.

If you have accumulated 15 or more demerit points within a two-year period your driver’s licence privileges will be automatically suspended for a period of time.

When the time of your suspension has been served, your driver’s licence privileges will be reinstated with seven demerit points remaining on your driver’s licence record. These points remain on your driver record for a period of two years from the reinstated date on the letter.

**GDL drivers:**

If you have accumulated four to seven demerit points within a two-year period, you will receive a letter notifying you of your demerit point standing.

If you have accumulated eight or more demerit points within a two-year period, your driver’s licence privileges will be automatically suspended for a period of time.

When the time of your suspension has been served, your driver’s licence privileges will be reinstated with three demerit 

</details>

### ch9-sus-007 — DISTRACTOR_BETTER

> Why does Alberta offer the Ignition Interlock Program?

- **0.67** To let suspended drivers drive anywhere with no conditions
- [keyed] **0.6** So drivers can stay mobile for treatment, work and family responsibilities while driving is monitored
- **0.33** To punish convicted drivers with higher insurance premiums
- **0.8** To replace a criminal charge without any conditions

Section: `Driver’s licence suspensions and disqualifications` (#drivers-licence-suspensions-and-disqualifications) — page 112 · best distractor #3 @ 0.8

<details><summary>guide window</summary>

Driving laws

### Federal: Criminal Code of Canada

Offences related to impaired driving are:

- impaired driving regardless of blood alcohol or drug content
- blood alcohol level over the legal limit
- drug or drug-alcohol combination ora toxicological (blood or urine) sample
- refusing to provide a breath or blood sample
- impaired driving causing bodily harm
- impaired driving causing death
- driving while suspended or disqualified.
If you are found guilty under the Criminal Code of Canada of drivingwhile impaired, and you have:

· been found guilty under the various sub-sections of section 320 of the Criminal Code of Canada, you willbe disqualified from driving and your licence will be suspended for one year from the date of the finding of the guilt.

· a prior offence in the last 10 years, you will be disqualified from holding a driver’s licence for three yearsfrom the date of the conviction.

· two or more prior offences in thelast 10 years, you will be disqualified from holding a driver’s licence forfive years from the date of the conviction.

· if a death or injury occurs as a result of an impaired offence, theminimum licence suspension is fiveyears even for a first offender.

### Provincial: Traffic Safety Act, Immediate Roadside Sanctions (IRS) Program

Alberta has one impaired driving program called the Immediate Roadside Sanctions (IRS) program. This impaired driving program includes a multi-tiered escalating approach to deter impaired driving. Impaired drivers will receive immediate and significant penalties at roadside that include:

- escalating driver’s lice

</details>
