<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Support;

use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\PublicApi\TermDirectory;
use App\Modules\Maintenance\Mail\ApprovalNoticeMail;
use App\Modules\Maintenance\Models\Intervention;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Parties\PublicApi\PartyDirectory;
use Illuminate\Support\Facades\Mail;

/**
 * Courriel d'information au mandant, à l'adresse principale de sa partie ; sans adresse, rien n'est envoyé (l'accord reste tracé
 * dans la chronologie). Mis en file après validation de la transaction.
 */
final readonly class Notices
{
    public function __construct(
        private PartyDirectory $parties,
        private OrganizationDirectory $organisations,
        private TermDirectory $termes,
    ) {}

    public function approval(Intervention $intervention, int $montant, string $echeance): void
    {
        $this->send($intervention, $montant, $echeance, false);
    }

    public function emergency(Intervention $intervention): void
    {
        $this->send($intervention, $intervention->estimated_amount === null ? null : (int) $intervention->estimated_amount->getAmount(), null, true);
    }

    private function send(Intervention $intervention, ?int $montant, ?string $echeance, bool $urgence): void
    {
        if ($intervention->mandant_party_id === null) {
            return;
        }

        $adresse = $this->parties->primaryEmail($intervention->mandant_party_id);

        if ($adresse === null) {
            return;
        }

        $nom = $this->organisations->names([$intervention->organization_id])[$intervention->organization_id] ?? '';
        $nature = $this->termes->find($intervention->nature_term_id, VocabularyKey::InterventionNature);
        $libelle = trim((string) preg_replace('/[\p{Cc}\p{Cf}]+/u', ' ', (string) ($nature->labels['fr'] ?? $nature->key)));
        $affiche = $montant === null ? null : number_format($montant / (10 ** (in_array($intervention->currency, ['XOF', 'XAF'], true) ? 0 : 2)), in_array($intervention->currency, ['XOF', 'XAF'], true) ? 0 : 2, ',', ' ').' '.$intervention->currency;

        Mail::to($adresse)->queue(new ApprovalNoticeMail($nom, $intervention->reference, $libelle, $affiche, $echeance, $urgence));
    }
}
