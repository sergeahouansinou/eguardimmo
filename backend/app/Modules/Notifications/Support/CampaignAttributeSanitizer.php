<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Support;

use Symfony\Component\HtmlSanitizer\HtmlSanitizerConfig;
use Symfony\Component\HtmlSanitizer\Visitor\AttributeSanitizer\AttributeSanitizerInterface;

/**
 * Filtre les styles en ligne et rattache chaque `cid:` à une image de la campagne.
 */
final readonly class CampaignAttributeSanitizer implements AttributeSanitizerInterface
{
    private const array FORBIDDEN = ['\\', '/*', '@', '<', '>', 'url', 'expression', 'import', 'javascript', 'vbscript', 'data:', 'behavior', 'binding'];

    private const array FUNCTIONS = ['rgb', 'rgba', 'hsl', 'hsla', 'calc'];

    /**
     * @param  array<string, string>  $images
     */
    public function __construct(private array $images) {}

    public function getSupportedElements(): ?array
    {
        return null;
    }

    public function getSupportedAttributes(): array
    {
        return ['style', 'src'];
    }

    public function sanitizeAttribute(string $element, string $attribute, string $value, HtmlSanitizerConfig $config): ?string
    {
        if ($attribute === 'style') {
            return $this->style($value);
        }

        $reference = str_starts_with(strtolower($value), 'cid:') ? substr($value, 4) : null;

        return $reference !== null && isset($this->images[$reference]) ? 'cid:'.$this->images[$reference] : null;
    }

    private function style(string $valeur): ?string
    {
        $minuscules = strtolower($valeur);

        if (preg_match('/[\x00-\x08\x0B\x0E-\x1F\x7F]/', $valeur) === 1) {
            return null;
        }

        foreach (self::FORBIDDEN as $motif) {
            if (str_contains($minuscules, $motif)) {
                return null;
            }
        }

        preg_match_all('/([a-z0-9_\-]*)\s*\(/', $minuscules, $appels);

        return array_diff($appels[1], self::FUNCTIONS) === [] ? $valeur : null;
    }
}
