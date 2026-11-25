<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Support;

use Symfony\Component\HtmlSanitizer\HtmlSanitizer;
use Symfony\Component\HtmlSanitizer\HtmlSanitizerConfig;

/**
 * Assainissement du HTML d'une campagne (ADR 0042) : liste blanche, liens https, mailto ou tel, images embarquées de la campagne seulement.
 */
final class CampaignHtml
{
    public const int MAX_BYTES = 200000;

    private const array ELEMENTS = [
        'h1' => ['align'], 'h2' => ['align'], 'h3' => ['align'], 'h4' => ['align'], 'h5' => ['align'], 'h6' => ['align'],
        'p' => ['align'], 'div' => ['align'], 'span' => [], 'br' => [], 'hr' => [], 'blockquote' => [], 'pre' => [], 'code' => [],
        'strong' => [], 'b' => [], 'em' => [], 'i' => [], 'u' => [], 's' => [], 'sub' => [], 'sup' => [], 'small' => [],
        'ul' => [], 'ol' => ['start', 'type'], 'li' => [],
        'a' => ['href', 'title'],
        'img' => ['src', 'alt', 'width', 'height'],
        'table' => ['width', 'height', 'border', 'cellpadding', 'cellspacing', 'align', 'role', 'bgcolor'],
        'caption' => [], 'colgroup' => ['span'], 'col' => ['span', 'width'], 'thead' => [], 'tbody' => [], 'tfoot' => [],
        'tr' => ['align', 'valign', 'bgcolor'],
        'td' => ['width', 'height', 'colspan', 'rowspan', 'align', 'valign', 'bgcolor'],
        'th' => ['width', 'height', 'colspan', 'rowspan', 'align', 'valign', 'bgcolor', 'scope'],
    ];

    private const array UNWRAPPED = ['html', 'body', 'main', 'section', 'article', 'header', 'footer', 'nav', 'aside', 'center', 'font', 'figure', 'figcaption'];

    /**
     * @param  array<string, string>  $images  référence citée par `cid:` => identifiant de l'image ; toute autre image disparaît
     */
    public function sanitize(string $html, array $images): string
    {
        // « Relatif » autorisé pour les médias : sans hôte, la bibliothèque rejette sinon les `cid:`. CampaignAttributeSanitizer refuse tout autre `src`.
        $config = (new HtmlSanitizerConfig)
            ->allowLinkSchemes(['https', 'mailto', 'tel'])
            ->allowRelativeLinks(false)
            ->allowMediaSchemes(['cid'])
            ->allowRelativeMedias(true)
            ->withAttributeSanitizer(new CampaignAttributeSanitizer($images))
            ->withMaxInputLength(-1);

        foreach (self::ELEMENTS as $element => $attributs) {
            $config = $config->allowElement($element, [...$attributs, 'style']);
        }

        foreach (self::UNWRAPPED as $element) {
            $config = $config->blockElement($element);
        }

        $propre = (new HtmlSanitizer($config))->sanitize($html);

        return trim((string) preg_replace('/<img\b(?![^>]*\ssrc="cid:)[^>]*>/i', '', $propre));
    }

    /**
     * @return list<string> identifiants des images citées
     */
    public function citedImages(string $html): array
    {
        preg_match_all('/<img\b[^>]*\ssrc="cid:([^"]+)"/i', $html, $trouvees);

        return array_values(array_unique($trouvees[1]));
    }

    public function toText(string $html): string
    {
        $texte = (string) preg_replace('/\s+/u', ' ', $html);
        $texte = (string) preg_replace_callback(
            '/<a\b[^>]*\shref="([^"]*)"[^>]*>(.*?)<\/a>/i',
            fn (array $lien): string => trim(strip_tags($lien[2])) === $lien[1] ? $lien[1] : trim($lien[2].' ( '.$lien[1].' )'),
            $texte,
        );
        $texte = (string) preg_replace('/<img\b[^>]*\salt="([^"]+)"[^>]*>/i', ' [$1] ', $texte);
        $texte = (string) preg_replace('/<li\b[^>]*>/i', "\n- ", $texte);
        $texte = (string) preg_replace('/<(br|hr)\b[^>]*>/i', "\n", $texte);
        $texte = (string) preg_replace('/<\/(td|th)>/i', ' ', $texte);
        $texte = (string) preg_replace('/<\/(p|div|h[1-6]|tr|table|ul|ol|blockquote|pre|caption)>/i', "\n\n", $texte);
        $texte = html_entity_decode(strip_tags($texte), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $texte = (string) preg_replace('/[ \t]*\n[ \t]*/', "\n", (string) preg_replace('/[ \t]+/', ' ', $texte));

        return trim((string) preg_replace('/\n{3,}/', "\n\n", $texte));
    }
}
