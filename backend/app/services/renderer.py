import logging
from pathlib import Path

from jinja2 import Environment, FileSystemLoader

logger = logging.getLogger("tam_copilot.renderer")

TEMPLATE_DIR = Path(__file__).resolve().parent.parent.parent / "templates"

_env = Environment(
    loader=FileSystemLoader(str(TEMPLATE_DIR)),
    autoescape=True,
)


def render_guide(
    data: dict,
    doc_type_slug: str,
    kcs_subtype: str | None = None,
    *,
    customer_name: str = "",
    product_name: str = "",
    touchpoint_date: str = "",
) -> str:
    meta = data.setdefault("meta", {})
    if customer_name:
        meta.setdefault("customer", customer_name)
    if product_name:
        meta.setdefault("product", product_name)
    if touchpoint_date:
        meta.setdefault("date", touchpoint_date)

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

    if doc_type_slug == "project-schedule":
        template_name = "schedule.html.j2"
        logger.info("render.start | type=schedule template=%s", template_name)
        template = _env.get_template(template_name)
        html = template.render(data=data)
        logger.info("render.done | template=%s html_len=%d", template_name, len(html))
        return html

    if doc_type_slug == "assessment":
        template_name = "assessment.html.j2"
        logger.info("render.start | type=assessment template=%s", template_name)
        template = _env.get_template(template_name)
        html = template.render(data=data)
        logger.info("render.done | template=%s html_len=%d", template_name, len(html))
        return html

    logger.info("render.start | type=generic template=base.html.j2 sections=%d", len(data.get("sections", [])))
    template = _env.get_template("base.html.j2")
    html = template.render(data=data)
    logger.info("render.done | template=base.html.j2 html_len=%d", len(html))
    return html
