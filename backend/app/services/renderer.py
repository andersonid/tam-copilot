from pathlib import Path
from jinja2 import Environment, FileSystemLoader

TEMPLATE_DIR = Path(__file__).resolve().parent.parent.parent / "templates"

_env = Environment(
    loader=FileSystemLoader(str(TEMPLATE_DIR)),
    autoescape=True,
)


def render_guide(data: dict, doc_type_slug: str, kcs_subtype: str | None = None) -> str:
    if doc_type_slug == "kcs-article":
        template_name = f"kcs_{kcs_subtype or 'solution'}.html.j2"
        try:
            template = _env.get_template(template_name)
        except Exception:
            template = _env.get_template("kcs_solution.html.j2")
        return template.render(data=data)

    template = _env.get_template("base.html.j2")
    return template.render(data=data)
