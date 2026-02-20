# Known Bugs & Outstanding Issues

**Last updated**: 2026-02-16

---

## Active Bugs

1. **React child error**: forwardRef icon components (intermittent — Lucide icons sometimes throw when passed as JSX)
2. **Operations editor not wired**: Block system (blockTypes.js, blockEvaluator.js, OperationsBuilder) is built but NOT connected to derived field evaluation. Currently derived fields use flat `allowedFields` config. The operations editor should be THE way to define complex conditions like `IF field("account") == "moms" THEN sum(field("amount"))`. See Phase 6.

---

## Outstanding Feature Gaps

3. **Question cycling from sibling list** — `getDayOfYear` + seeded random implemented but needs more testing for consistent daily cycling
4. **Default template for day pages** — Auto-fill new day pages from a saved template on date change
5. **Derive grid.fieldIds** — Remove from schema, compute from `Field.find({gridId})` on demand
6. **TypeScript/JSDoc** — No type safety. Add interfaces for all 15 models.
7. **Standalone Template model** — `grid.templates[]` is a nested array. Make it a top-level model for cross-grid sharing.

---

## Resolved (Feb 15-16)

- Drag and drop not working in docs (missing occurrence prop, position-aware pill insertion)
- Day page not following grid iteration change
- History popup z-index (bumped to 1100)
- Copy/copylink in same list should be a move
- Category dropdown labeling ("Filter: No Filter")
- Obsidian-style heading markers (# prefix via CSS ::before)
- Pills use # syntax
- View type selector moved to panel settings
- Iteration buttons open by default
- Flow direction UI (Popover with 3 options)
- Pill hover radial menu (cog button with copy/copylink/move/remove)
- Q&A fields in day journal template (journalQuestion/journalAnswer with siblingLinks)
- Financial tracking (Account select, Purchase instance, Mom's Account derived)
- Cascading style overrides (Phase 5.1 — Panel/Container/Instance style inheritance)
- Heading live preview (# marks only show when cursor is on heading)
- Double-click to edit pill labels (instance and field pills)
- [object Object] bug on Duration/Amount fields (extractValue safety check)
- Evening reflection questions as field pills (Q&A pattern)
- Combined Reading/Watchlist fields (single instance with select + quickAdd)
- Categorized Todo containers (Home, Finance, Work, Personal)
- Stan lyrics doc with stanza pills






OLD- i feel like you dont
  understand that i want this organized, uniform, and logically makes sense with all the models being used for
  their correct purposes. we should not be duplicating functionality with "synthetic" things. like read the definition of occurance, it should be used for that. 
- the hashtags should not be showing up unless its being edited. they should just be processed until then. (just be the finished header, dont show the hashtags until i edit.)
- all these editing fixed should apply to all pills (i cant answer questions/edit answers)
- please review all of this and make sure that the pills and editing are working correctly. i feel like we are doing all these tiny fixes that shouldnt be there to begin with if you understood what im going for. it should have been just like raw markdown for everything in it when i double click. idk why you seperated out labels and such to begin with. it was supposed to be just whatsever in the pill is the full text and the label was part of that. idk why we have seperate labels it should just be the content. (header included in the text). please put this into a phase 5 change cause it should be more raw in a way and that should probably extend to instances too. put that and occurances in phase 5 cause i think thats too big of a refactor atm
- id like a bigger version of the logo on the login page and above the loading spinner (with the title +moduli+)
- if i move a copylinked or copied around its own doc, it should only move and not copy. right now the copylinks we have are duplicating when i move it around the page. 
- also cant edit the bulletpoints with typing either like the header. at least ones with pills on the line. i should be able to push things around the pills using typing. and if i backspace into a pill. it should go in the editmode of the pill with the cursor at the end. if i click in front of a pill, the cursor should go there. if i click in between a bulletpoint (or any text or end of line), the cursor should go there. i need the pills to work with typing and the cursor. like if i press enter in front of the pill, it would push it down. if i pressed enter inside of the pill (shift enter, it works as a normal texting enter key inside the pill, but hitting enter by itself just does the save)
- also nothing happened when i dragged a image file to the doc page (nothing saved on drop) and when i dragged it to a list, it just made an instance with the file name. is that because we dont have a file save path set up at the moment? we should be able to upload files and display those. is that in phase 5 or something? move the artifact stuff up to phase 4 and work on it in this iteration. id like to see the file previewed in both instances and as pills inside the doc if i drag it there. both should display the file inside of the instance and pills. each piece of media should have a fullscreen button superimposed in the top right corner of it on hover, so i can expand it to view it in the viewer. if i dont click on the fullscreen button, my clicks should just interact with the media (like pressing play on a video).
- add also in phase 5, to add a pomodoro timer in the toolbar 
- actually we do need the occurances thing right now cause edits to the doc for pills arent persisting
- also the editor toolbar should be sticky so the scroll doesnt cover it
- also the individual derived fields should be in their own seperate instances inside that container. and just show the fields, not a label for the instance itself
- the stuff for movies and shows, like the lists we can pull from, should be multiselects with an input option, also next to that multiselect should be a randomize button next to the dropdown that auto selects just 1 option from the list at random
- also the accounts section we have it resetdata should be based on totals (past the day) so that panel should not have a context technically
- also idk if our system is set up like this, but the tasks list should be total (so that shouldnt have a time iteration atm either) and those tasks shouldnt have checkboxes, they are measured in when they get added to the schedule. so idk if our system differentiates via derived fields but those dont need done checkboxes like the habits
- also those checkboxes should be switches anyway too
- prioritize these bugs cause we only have 7% usage left this week. get as much as you can get done 




NEW NEW NEW: 
- the radial menu for pills closes before i can click on anything and the. also dont show the hashtag for pills either 
- id like to make it like this:

Id like a workout instance that as a list of workouts to pick from (regular select) and then have a reps input field, and be able to fill in reps and how many times per, for each workout added. i think we should add a link field sorta thing (what we can do for question/answers as well), 


scratch that. i figured it out i think, these are the changes i want to add:

first of all,
- i want containers and instances to have the same drag and drop as docs does. we will insert fields into that markdown too (so instead of a seperate text and fields section). i dont want this to take the place of how we do containers and instances normally. thats for lists. this is for docs. i mean they can be used anywhere but a list type container and a doc type container are diff but they interact with the rest of the grid tho. like i can have a doc type container in a list panel and put it in a doc one as well. just like the instance pills that are in docs, we dont want instances to be droppable at the moment. the instance pills will be the instances in the doc case, and container pills, will be the containers, and we can call it something other than pills actually. but it should look like how the stan lyrics are now with each section. and make the instance pills we have look exactly the same, but with the name change.
really think about the drag and drop for docs and making sure its air tight. 
- i want to be able to include a code to activate inserting a container or instance or field into the doc components (using the @ sign, pulls up dropdown select that works as a search for fields, instances, artifacts, containers, operations (youll see why) and then  it inserts that object when selected.)
- would changing iterations to be more of filters on fields be beneficial or would i lose functionality? like changing time to a field that we base it on. or are we already doing that?
- put the grid, panels, containers, instances, fields, artifacts, inside the manifest tree as well. inside a folder called grids and we can have multiple references to the same thing in the manifest multiple places too. cause i want a main artificats folder but i also want them referenced in the grids folder (located both places)
- we want an operations/command center, where we have the ability to activate different operations (using buttons and such) and manage them. the operations would be like we talked about with the order of applications with conditions and such. add in calculations here as well
- but we want the ability to have a source data, whether thats from (file directory, instagram saves, bookmark manager, etc. you dont need to add those right now), but most of all, data from instances and such. this is where we pass data along to the derived. these are the operations that will be used to calculate those goals now. im not sure exactly how it would look but

im not sure what the order of operations should be but we need these. 

-pull in source data
-assign data
-conditions (based on what fields are attached, if its an instance or container, what iteration it is, etc. this one i do want implemented)
-run calculations and put together the equation for it
-then do type action: move object, recalculate object, assign object, apply object, change object, change value, changeApperence, changeorder, changesize, changelayout show object, do external function, kick off other operation, copy object, copylink object, delete object. (objects can be instance, containers, panels, grids, fields, inputs, iterations), i want to have a top bottom cod using just blocks like snap! we talked about

so if this then do that and then this, if this do this and if this do this or whatever.

- pretty much i want it to be like an operations for the system itself. where we can change anything we want based on the source data and when and where it is landing and coming from (whether its an instance, container, or attached stuff)
- we may also want to have an option to when to kick it off. like "when something drops in this spot or this panel and its an instance, or whatever" or when a field changes somewhere using input. 
- these operations will have buttons in the command center to kick them off as well. also the fields manager should probably go in the command center as well and we should have a dedicated button to open that up. then we can put the actions i named above in that search bar that pops up for a command pallete too. we want a command center and a command pallet

 
also canvases should have templates&iterations too where we can attach a document and our canvas is overlaid on top of it, like the document is the background. and then we have free range moving of containers and instances on the page.


could you also fill my notebook up with organized notes on these subjects: (look at my profile overview file in the root folder) please put together like school level notes on my different interests and feed it into the notebook in an organized way. please review the raw words and put them into systematic categories in the docs and manifest, you know?

so the next big changes are implementing these doc/editable markdown elements inside the proper objects (containers and instances), make a command center for fields and operations, give operations to derived fields (this is what we do for calculations now and what gets displayed), we also have input operations, source data, and then end action or data or whatever, and i want the notebook filled. add canvas thing to the next phase after this. but the rest of the stuff i said should be in whatever phase we are in now. 

OOO also add in this phase, with the command center, it should be fields, operations, connection (for setting folder paths, url feeds, api feeds, drives, etc) (then in fields and operations we can access stuff from them, also the folder paths for file storage location), put a files tab in there (for like a global bank of the manifest and artifacts (more than just the grid but based on user instead, where they are instances that i can drag out of.))

actually, do that for all of the tabs. these are all like global managers of this stuff but each tab should have a collection of drag elements for the things we are managing. like make it draggable but with a cog for editing it (replaces screen with editor (or the command center pulldown i mean)).

with that being said, there should be a tool for the components (panels, containers, instances) (the tree manifest for all the components globablly (for the user) and based on each grid being a folder) 

the stuff being dragged are copies of course, and the zone there is not droppable. its a bank of stuff
fields should be able to drag from there and copied/attached to instances, containers, and panels (as tiny little pills)

i guess dont give connections drag (since its used for fields and operations)


(you can make these just drop in for panel list, container list), and precision drop for all the docs stuff obviously. 

the operations ones need to be draggable, to attach to instances, containers, panels, as buttons or inputs and buttons sorta thing. so i can run operations on the fly from anywhere. any list or doc. (and since operations really get run on fields (without the button))

we should also make fields its own component inside the grid, instead of just instance. fields can be attached to anything, same with the other tab stuff.

the last tab, should be setting keyboard shortcuts (doesnt need to be draggable)

add in user settings as the first tab by the way

 we have like 5 or 6 tabs now i think which is fine.

i think that covers everything

so stuff is being moved around again i think

we need all of this in there. as you can see, im kinda adding an all around command center for automation and operations, snap! is that ifttt thing is kinda an inspiration for it. we have multiple ways to add stuff to the grid (via keyvoard, drag and drop, in the settings of that component). being able to drag stuff in and upload it to our file system/internal or external drive.

as you can see we have alot more draggables so we need to make sure its organized in an high level way. like if we dont, maybe we should have a drag hook or something to attach to these new draggables and the old ones. like a uniform object oriented way if that makes sense.

also i want the ability turn turn markdown lists into individual instances. and use them also the ability to add them to fields (in the field settings for dropdown options, they should be able to be added there, so i can turn a doc list of tasks/items into selects and multiselects fields, this is just another way of handling tasks/items, via a select dropdown) and i should be able to add instances to lists too. we should just add in a list tab in the command center that handles lists. (for the selects and multiselects). those should be draggable as well (the representation of the list), and when i drop them onto an instance, it adds the list to the instance doc component, if its dropped in a container, it creates instances inside that container, if you drop in a panel, it follows the pattern (creates containers in the list panels but in the doc panels it just adds it as a text list). so i should be able to highlight, right click, hit add to list, create list, turn into container or instance or panel or whatever. just a right click menu of it.

I also want to add in, we should make sure we are following the book the pragmatic programmer, when it comes to our coding philosophy. we should make sure we are using that as a guide for how the system is built out so start focusing on keeping balanced with that in how you code.


Really think about all of this and review the system, and Add all of this to the current phase. 


add into the later phase where the ai assistant works as like a profile builder, through conversations with it. because we built out automation, we can connect that to the ai and have it build out a full on system for the user. using their mental health issues, interests, and dayplanner as key. 

and then you know, tailoring it after to work as a digital assistant that can build and modify the grids based on what you tell it.

So i can send it a message that says: completed this task at this time. and the system moves it for you.

its becoming into jarvis finally.

having a framework of the system can eventually be translate to mutable holograms at somepoint.

also any txt or md or pdf in the root folder of this, put into the database as a doc and put it in a quick_notes folder in the manifest. use your best judgement on if things should be markdown text, a container with the doc stuff (try to make it like the stan doc we have when its appropriate)

i also want to make sure we have copy and copylinks, onto panels as well. cause in the radialmenu we are gonna have a split option for panel where it adds a col in the grid (to the right of the panel being affected) and put in a copy of the panel in that spot, so i can move stuff quicking between documents and such