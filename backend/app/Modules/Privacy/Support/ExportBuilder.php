<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Support;

use App\Modules\Identity\PublicApi\AccountDataExport;
use App\Modules\Messaging\PublicApi\SupportTicketsOf;
use App\Modules\Notifications\PublicApi\AccountNotificationData;
use App\Modules\Privacy\Enums\ErrorCode;
use App\Modules\Privacy\Models\PrivacyRequest;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Storage;

/**
 * Export JSON d'un compte, chiffré sur le disque privé : seul le demandeur le télécharge, l'opérateur ne le lit jamais.
 */
final readonly class ExportBuilder
{
    public function __construct(
        private AccountDataExport $compte,
        private SupportTicketsOf $demandes,
        private AccountNotificationData $notifications,
    ) {}

    /**
     * @return string chemin du fichier sur le disque d'export
     */
    public function build(PrivacyRequest $demande, string $userId): string
    {
        $compte = $this->compte->forAccount($userId) ?? throw ErrorCode::AccountRequired->problem();

        $sections = [$compte, $this->demandes->forAccount($userId), $this->notifications->forAccount($userId)];

        $contenu = [
            'request' => ['id' => $demande->id, 'kind' => $demande->kind->value, 'generated_at' => now()->toIso8601String()],
            'organization_data' => 'Les données détenues par les organisations auxquelles vous êtes lié sont traitées par ces organisations : votre demande leur a été transmise.',
        ];

        foreach ($sections as $section) {
            $contenu[$section->key] = $section->data;
        }

        $chemin = trim((string) config('privacy.export_directory'), '/')."/{$demande->id}.json.enc";
        $this->disque()->put($chemin, Crypt::encryptString(json_encode($contenu, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)));

        return $chemin;
    }

    public function read(string $chemin): ?string
    {
        $contenu = $this->disque()->get($chemin);

        return $contenu === null ? null : Crypt::decryptString($contenu);
    }

    public function delete(string $chemin): void
    {
        $this->disque()->delete($chemin);
    }

    private function disque(): Filesystem
    {
        return Storage::disk((string) config('privacy.export_disk'));
    }
}
