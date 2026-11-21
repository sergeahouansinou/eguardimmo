<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Notifications\Enums\CampaignAudience;
use App\Modules\Notifications\Mail\CampaignMail;
use App\Modules\Notifications\Support\CampaignAccess;
use App\Modules\Notifications\Support\FrenchDates;
use App\Modules\Notifications\Support\MailProvider;
use App\Modules\Notifications\Support\MergeFields;
use App\Modules\Notifications\Support\PlainText;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Shared\Audit\RecordAudit;
use App\Shared\Mail\MailText;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Mail;

final readonly class SendCampaignTest
{
    public function __construct(
        private CampaignAccess $acces,
        private MailProvider $fournisseur,
        private OrganizationDirectory $organisations,
        private CurrentOrganization $organisation,
        private RecordAudit $audit,
    ) {}

    /**
     * Envoi de test à l'adresse de l'auteur seulement, jamais à une adresse reçue du client ; les champs de fusion prennent des valeurs
     * d'exemple. Le plafond de 5 par heure et par compte est tenu par la route.
     *
     * @return array{sent_to: string, subject: string, sent_at: CarbonImmutable}
     */
    public function handle(User $auteur, string $objet, string $corps, CampaignAudience $audience): array
    {
        $this->acces->assertManager($auteur);
        $this->fournisseur->assertEnabled();

        $exemples = ['Prénom' => 'Koffi', 'Bien' => 'Résidence Exemple – Apt A1', 'Mandat' => 'M-2026-0001', 'Mois' => FrenchDates::monthYear(now()), 'Échéance' => '1er du mois prochain'];
        $valeurs = array_intersect_key($exemples, array_flip(MergeFields::allowedFor($audience)));
        $nom = MailText::plain($this->organisations->names([$this->organisation->id()])[$this->organisation->id()] ?? 'Votre agence');

        Mail::mailer($this->fournisseur->mailer())->to($auteur->email)->send(new CampaignMail(
            $this->fournisseur->fromAddress(),
            $nom,
            '[Test] '.MailText::plain(MergeFields::render($objet, $valeurs)),
            PlainText::fromMarkup(MergeFields::render($corps, $valeurs)),
            null,
            null,
            null,
            0,
            [],
        ));

        $this->audit->handle('notifications.campaign.test_sent');

        return ['sent_to' => $auteur->email, 'subject' => $objet, 'sent_at' => CarbonImmutable::now()];
    }
}
