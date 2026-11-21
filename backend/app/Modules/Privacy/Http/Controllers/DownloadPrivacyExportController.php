<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Http\Controllers;

use App\Modules\Identity\Models\User;
use App\Modules\Privacy\Actions\PrepareExportDownload;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * Le demandeur seul : la requête est bornée à ses propres demandes.
 */
final class DownloadPrivacyExportController
{
    public function __invoke(Request $requete, string $privacyRequest, PrepareExportDownload $telechargement): Response
    {
        /** @var User $user */
        $user = $requete->user();

        return new Response($telechargement->handle($user, $privacyRequest), 200, [
            'Content-Type' => 'application/json',
            'Content-Disposition' => 'attachment; filename="export-donnees-personnelles.json"',
        ]);
    }
}
