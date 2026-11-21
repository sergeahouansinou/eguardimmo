<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Support;

use App\Modules\Recovery\Enums\ErrorCode;

final class TransmissionLink
{
    /**
     * Adresse https du lien envoyé par e-mail : le modèle configuré (page publique), sinon la route de l'API. Un modèle sans
     * `{token}` ou hors https est refusé : il enverrait le même lien à tous ou un lien sans jeton.
     */
    public function build(#[\SensitiveParameter] string $token): string
    {
        $modele = config('recovery.transmission.link_url');
        $modele = is_string($modele) && $modele !== '' ? $modele : rtrim((string) config('app.url'), '/').'/api/v1/recovery/downloads/{token}';

        if (! str_contains($modele, '{token}') || ! str_starts_with(strtolower($modele), 'https://')) {
            throw ErrorCode::LinkUnavailable->problem();
        }

        return str_replace('{token}', $token, $modele);
    }

    public function assertConfigured(): void
    {
        $this->build(str_repeat('x', LinkTokens::LENGTH));
    }
}
