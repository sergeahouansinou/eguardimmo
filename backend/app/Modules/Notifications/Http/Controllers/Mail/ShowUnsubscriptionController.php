<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Controllers\Mail;

use App\Modules\Notifications\Actions\PreviewUnsubscription;
use App\Modules\Notifications\Support\UnsubscribePage;
use App\Shared\Http\ApiProblem;
use Illuminate\Http\Response;

/**
 * Page de confirmation sans effet : un aperçu de lien par une messagerie ne désinscrit personne.
 */
final class ShowUnsubscriptionController
{
    public function __invoke(string $token, PreviewUnsubscription $apercu): Response
    {
        try {
            return UnsubscribePage::render('confirm', $apercu->handle($token));
        } catch (ApiProblem) {
            return UnsubscribePage::render('invalid', statut: 404);
        }
    }
}
