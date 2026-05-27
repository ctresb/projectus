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
    padding: 0 1;
}}

#logo {{
    width: 100%;
    content-align: center middle;
    padding-top: 0;
    padding-bottom: 0;
}}

#subtitle {{
    width: 100%;
    content-align: center middle;
    color: {MUTED};
    padding-bottom: 0;
}}

#body {{
    height: 1fr;
    width: 100%;
}}

#menu-panel {{
    width: 100%;
    height: 12;
    border: tall {ACCENT};
    background: {PANEL};
    padding: 0 1;
}}

#log-panel {{
    width: 100%;
    height: 1fr;
    border: tall #5E5437;
    background: #100E0A;
    padding: 0 1;
    margin-top: 1;
}}

#screen-title {{
    color: {ACCENT};
    text-style: bold;
    padding-bottom: 0;
}}

#hint {{
    color: {MUTED};
    padding-top: 0;
}}

#log-title {{
    color: {ACCENT};
    text-style: bold;
    padding-bottom: 0;
}}

OptionList {{
    height: 6;
    border: none;
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
