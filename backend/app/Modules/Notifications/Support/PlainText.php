<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Support;

/**
 * Corps d'une diffusion pour un e-mail en texte brut : la mise en forme du front (`**gras**`, `*italique*`, `__souligné__`) s'efface,
 * jamais de HTML, jamais de caractère de contrôle autre que le saut de ligne.
 */
final class PlainText
{
    public static function fromMarkup(string $texte): string
    {
        $net = (string) preg_replace('/[^\P{Cc}\n]|[\p{Cf}\p{Zl}\p{Zp}]/u', '', str_replace(["\r\n", "\r"], "\n", $texte));

        return trim((string) preg_replace('/\*\*(.+?)\*\*|__(.+?)__|\*(.+?)\*/su', '$1$2$3', $net));
    }
}
