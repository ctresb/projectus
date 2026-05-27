ACCENT = "#FAD344"
ACCENT_END = "#FF852E"
TEXT = "#F5F2EA"
BACKGROUND = "#16130E"
PANEL = "#242016"
MUTED = "#AFA899"
ERROR = "#FF6B5F"
SUCCESS = "#9BE078"

CSS = f"""
Screen {{
    background: {BACKGROUND};
    color: {TEXT};
}}

#root {{
    height: 100%;
    padding: 1 2;
}}

#logo {{
    width: 100%;
    content-align: center middle;
    padding-top: 1;
    padding-bottom: 1;
}}

#subtitle {{
    width: 100%;
    content-align: center middle;
    color: {MUTED};
    padding-bottom: 1;
}}

#body {{
    height: 1fr;
}}

#menu-panel {{
    width: 42%;
    min-width: 42;
    height: 100%;
    border: tall {ACCENT};
    background: {PANEL};
    padding: 1 1;
}}

#log-panel {{
    width: 1fr;
    height: 100%;
    border: tall #5E5437;
    background: #100E0A;
    padding: 1 1;
    margin-left: 2;
}}

#screen-title {{
    color: {ACCENT};
    text-style: bold;
    padding-bottom: 1;
}}

#hint {{
    color: {MUTED};
    padding-top: 1;
}}

#log-title {{
    color: {ACCENT};
    text-style: bold;
    padding-bottom: 1;
}}

OptionList {{
    height: 1fr;
    background: {PANEL};
    color: {TEXT};
}}

OptionList > .option-list--option {{
    padding: 0 1;
}}

OptionList > .option-list--option-highlighted {{
    background: {ACCENT};
    color: #17130A;
    text-style: bold;
}}

OptionList > .option-list--option-disabled {{
    color: #756E62;
}}

RichLog {{
    height: 1fr;
    background: #100E0A;
    color: {TEXT};
}}

Footer {{
    background: #100E0A;
    color: {MUTED};
}}
"""
