import logging
from pathlib import Path

from jinja2 import Environment, FileSystemLoader

logger = logging.getLogger("tam_copilot.renderer")

TEMPLATE_DIR = Path(__file__).resolve().parent.parent.parent / "templates"

_env = Environment(
    loader=FileSystemLoader(str(TEMPLATE_DIR)),
    autoescape=True,
)


def render_guide(data: dict, doc_type_slug: str, kcs_subtype: str | None = None) -> str:
    if doc_type_slug == "kcs-article":
        template_name = f"kcs_{kcs_subtype or 'solution'}.html.j2"
        logger.info("render.start | type=kcs template=%s", template_name)
        try:
            template = _env.get_template(template_name)
        except Exception:
            logger.warning("render.template_fallback | requested=%s fallback=kcs_solution.html.j2", template_name)
            template = _env.get_template("kcs_solution.html.j2")
        html = template.render(data=data)
        logger.info("render.done | template=%s html_len=%d", template_name, len(html))
        return html

    logger.info("render.start | type=generic template=base.html.j2 sections=%d", len(data.get("sections", [])))
    template = _env.get_template("base.html.j2")
    html = template.render(data=data)
    logger.info("render.done | template=base.html.j2 html_len=%d", len(html))
    return html
