<?php

declare(strict_types=1);

use App\Modules\Documents\Enums\CertificateState;
use App\Modules\Documents\Events\CertificateDeadlineReached;
use App\Modules\Identity\Models\User;
use App\Modules\Inspections\Events\InspectionPublished;
use App\Modules\Inspections\Events\InspectionRemarkAnswered;
use App\Modules\Inspections\Events\InspectionRemarkReceived;
use App\Modules\Leases\Enums\NoticeRequestOutcome;
use App\Modules\Leases\Events\LeaseDocumentShared;
use App\Modules\Leases\Events\LeaseInsuranceDecided;
use App\Modules\Leases\Events\LeaseInsuranceReminded;
use App\Modules\Leases\Events\LeaseInsuranceSubmitted;
use App\Modules\Leases\Events\NoticeRequestAcknowledged;
use App\Modules\Leases\Events\NoticeRequestClosed;
use App\Modules\Leases\Events\NoticeRequested;
use App\Modules\Leases\Events\NoticeRequestUnacknowledged;
use App\Modules\Notifications\Enums\NotificationAudience;
use App\Modules\Notifications\Enums\NotificationChannel;
use App\Modules\Notifications\Enums\NotificationType as Type;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Models\NotificationPreference;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Parties\Events\ContactUpdateRequested;
use App\Modules\Payments\Events\OnlinePaymentFailed;
use Illuminate\Support\Str;
use Tests\Feature\Notifications\NotificationsContext as N;
use Tests\Feature\Tenant\TenantContext as T;
use Tests\Feature\Tenant\TenantRentContext as R;
use Tests\Feature\Tenant\TenantWriteContext as W;

beforeEach(function (): void {
    $this->w = W::monde($this);
    $this->org = $this->w['org'];
    $this->moi = $this->w['moi'];
    $this->bail = $this->moi['lease'];
    $this->coloc = T::colocataire($this->org, $this->bail);
    $this->comptaColoc = User::factory()->create();
    R::rattacher($this->org, $this->coloc, $this->comptaColoc);
    $this->equipe = [$this->w['owner'], $this->w['manager']];
    $this->id = fn (): string => (string) Str::uuid7();
});

it('seize types sont déclarés, avec la bonne audience et sans canal verrouillé hors ADR', function (): void {
    $attendus = [
        'leases.notice_requested' => [NotificationAudience::Staff, ['in_app', 'email'], ['in_app']],
        'leases.notice_unacknowledged' => [NotificationAudience::Staff, ['in_app', 'email'], []],
        'tenant.notice_acknowledged' => [NotificationAudience::Tenant, ['in_app', 'email'], ['in_app']],
        'tenant.notice_closed' => [NotificationAudience::Tenant, ['in_app', 'email'], ['in_app']],
        'leases.insurance_submitted' => [NotificationAudience::Staff, ['in_app'], []],
        'tenant.insurance_accepted' => [NotificationAudience::Tenant, ['in_app', 'email'], []],
        'tenant.insurance_rejected' => [NotificationAudience::Tenant, ['in_app', 'email'], []],
        'tenant.insurance_expiring' => [NotificationAudience::Tenant, ['in_app', 'email', 'push'], []],
        'tenant.insurance_expired' => [NotificationAudience::Tenant, ['in_app', 'email', 'push'], []],
        'tenant.insurance_reminder' => [NotificationAudience::Tenant, ['in_app', 'email', 'push'], []],
        'tenant.document_shared' => [NotificationAudience::Tenant, ['in_app', 'email'], []],
        'tenant.inspection_published' => [NotificationAudience::Tenant, ['in_app', 'email'], []],
        'inspections.remark_received' => [NotificationAudience::Staff, ['in_app', 'email'], []],
        'tenant.inspection_remark_answered' => [NotificationAudience::Tenant, ['in_app', 'email'], []],
        'tenant.online_payment_failed' => [NotificationAudience::Tenant, ['in_app', 'email'], []],
        'parties.contact_update_requested' => [NotificationAudience::Staff, ['in_app'], []],
    ];
    $canaux = fn (array $liste): array => array_map(fn (NotificationChannel $c): string => $c->value, $liste);

    foreach ($attendus as $valeur => [$audience, $defauts, $verrouilles]) {
        $type = Type::from($valeur);

        expect($type->audience())->toBe($audience, $valeur)
            ->and($canaux($type->defaults()))->toBe($defauts, $valeur)
            ->and($canaux($type->locked()))->toBe($verrouilles, $valeur)
            ->and($type->pushBody())->not->toBeEmpty()
            ->and($type->roles() === [] || $audience === NotificationAudience::Staff)->toBeTrue();

        if ($audience === NotificationAudience::Staff) {
            expect($type->roles())->toBe([MemberRole::Owner, MemberRole::Admin, MemberRole::Manager], $valeur);
        }
    }
});

it('congé : l\'équipe est prévenue du dépôt et du retard, seule la fiche déclarante des suites', function (): void {
    $id = ($this->id)();
    $partie = $this->moi['party']->id;

    NoticeRequested::dispatch($id, $this->bail->id, $this->org->id);
    NoticeRequestUnacknowledged::dispatch($id, $this->bail->id, $this->org->id, $partie);
    NoticeRequestAcknowledged::dispatch($id, $this->bail->id, $this->org->id, $partie);
    NoticeRequestClosed::dispatch($id, $this->bail->id, $this->org->id, $partie, NoticeRequestOutcome::Recorded);

    foreach ($this->equipe as $membre) {
        expect(N::types($membre))->toBe(['leases.notice_requested', 'leases.notice_unacknowledged']);
    }

    expect(N::nombre($this->w['accountant']))->toBe(0)
        ->and(N::types($this->moi['user']))->toBe(['tenant.notice_acknowledged', 'tenant.notice_closed'])
        ->and(N::nombre($this->comptaColoc))->toBe(0);

    $demande = N::premiere($this->w['owner'], Type::LeasesNoticeRequested);
    expect($demande->link)->toBe("/baux/{$this->bail->id}")
        ->and($demande->body)->toContain($this->bail->reference)
        ->and(N::premiere($this->moi['user'], Type::TenantNoticeClosed)->link)->toBe('/bail/conge');

    NoticeRequestAcknowledged::dispatch($id, $this->bail->id, $this->org->id, $partie);
    NoticeRequested::dispatch($id, $this->bail->id, $this->org->id);

    expect(N::nombre($this->moi['user'], Type::TenantNoticeAcknowledged))->toBe(1)->and(N::nombre($this->w['owner'], Type::LeasesNoticeRequested))->toBe(1);
});

it('congé : une demande remplacée et une demande enregistrée donnent chacune leur notification', function (): void {
    $id = ($this->id)();

    NoticeRequestClosed::dispatch($id, $this->bail->id, $this->org->id, $this->moi['party']->id, NoticeRequestOutcome::Superseded);
    NoticeRequestClosed::dispatch($id, $this->bail->id, $this->org->id, $this->moi['party']->id, NoticeRequestOutcome::Recorded);

    expect(N::nombre($this->moi['user'], Type::TenantNoticeClosed))->toBe(2);
});

it('assurance : dépôt vers l\'équipe, décision vers le déposant seul, relance vers les locataires du bail', function (): void {
    $id = ($this->id)();

    LeaseInsuranceSubmitted::dispatch($id, $this->bail->id, $this->org->id);
    LeaseInsuranceDecided::dispatch($id, $this->bail->id, $this->org->id, $this->moi['party']->id, false);
    LeaseInsuranceDecided::dispatch(($this->id)(), $this->bail->id, $this->org->id, $this->moi['party']->id, true);
    LeaseInsuranceReminded::dispatch($this->bail->id, $this->org->id, '2026-11-20');
    LeaseInsuranceReminded::dispatch($this->bail->id, $this->org->id, '2026-11-20');

    expect(N::types($this->w['manager']))->toBe(['leases.insurance_submitted'])
        ->and(N::nombre($this->w['accountant']))->toBe(0)
        ->and(N::types($this->moi['user']))->toBe(['tenant.insurance_rejected', 'tenant.insurance_accepted', 'tenant.insurance_reminder'])
        ->and(N::types($this->comptaColoc))->toBe(['tenant.insurance_reminder'])
        ->and(N::premiere($this->moi['user'], Type::TenantInsuranceRejected)->body)->not->toContain('motif :')
        ->and(N::premiere($this->moi['user'], Type::TenantInsuranceReminder)->body)->toContain('pas une mise en demeure')
        ->and(N::premiere($this->moi['user'], Type::TenantInsuranceReminder)->link)->toBe('/assurance')
        ->and(N::premiere($this->moi['user'], Type::TenantInsuranceReminder)->push)->toBeTrue();
});

it('échéance de l\'assurance : les locataires du bail sont prévenus, l\'équipe ne reçoit pas la pièce de conformité', function (): void {
    CertificateDeadlineReached::dispatch('cert-1', $this->org->id, CertificateState::ToRenew, '2026-12-01', 'Assurance habitation', 'lease', $this->bail->id);
    CertificateDeadlineReached::dispatch('cert-1', $this->org->id, CertificateState::ToRenew, '2026-12-01', 'Assurance habitation', 'lease', $this->bail->id);
    CertificateDeadlineReached::dispatch('cert-1', $this->org->id, CertificateState::Expired, '2026-12-01', 'Assurance habitation', 'lease', $this->bail->id);

    expect(N::types($this->moi['user']))->toBe(['tenant.insurance_expiring', 'tenant.insurance_expired'])
        ->and(N::types($this->comptaColoc))->toBe(['tenant.insurance_expiring', 'tenant.insurance_expired'])
        ->and(N::nombre($this->w['owner']))->toBe(0)
        ->and(N::premiere($this->moi['user'], Type::TenantInsuranceExpiring)->body)->toContain('01/12/2026')->not->toContain('Assurance habitation');

    CertificateDeadlineReached::dispatch('cert-2', $this->org->id, CertificateState::ToRenew, '2026-12-01', 'Diagnostic', null, null);
    CertificateDeadlineReached::dispatch('cert-3', $this->org->id, CertificateState::ToRenew, '2026-12-01', 'Diagnostic', 'unit', ($this->id)());

    expect(N::nombre($this->w['owner'], Type::CertificateToRenew))->toBe(2)->and(N::nombre($this->moi['user']))->toBe(2);
});

it('document partagé : tous les locataires du bail, ou la seule fiche visée', function (): void {
    LeaseDocumentShared::dispatch(($this->id)(), $this->bail->id, $this->org->id, null);
    LeaseDocumentShared::dispatch(($this->id)(), $this->bail->id, $this->org->id, $this->coloc->id);

    expect(N::types($this->moi['user']))->toBe(['tenant.document_shared'])
        ->and(N::types($this->comptaColoc))->toBe(['tenant.document_shared', 'tenant.document_shared'])
        ->and(N::premiere($this->moi['user'], Type::TenantDocumentShared)->link)->toBe('/documents')
        ->and(N::nombre($this->w['owner']))->toBe(0);
});

it('état des lieux : publication vers les locataires, remarque vers l\'équipe, réponse vers l\'auteur seul', function (): void {
    $edl = ($this->id)();
    $remarque = ($this->id)();

    InspectionPublished::dispatch($edl, $this->bail->id, $this->org->id, 'entry');
    InspectionRemarkReceived::dispatch($remarque, $edl, $this->bail->id, $this->org->id, $this->moi['party']->id);
    InspectionRemarkAnswered::dispatch($remarque, $edl, $this->bail->id, $this->org->id, $this->moi['party']->id, 'accepted');

    expect(N::types($this->moi['user']))->toBe(['tenant.inspection_published', 'tenant.inspection_remark_answered'])
        ->and(N::types($this->comptaColoc))->toBe(['tenant.inspection_published'])
        ->and(N::types($this->w['manager']))->toBe(['inspections.remark_received'])
        ->and(N::premiere($this->moi['user'], Type::TenantInspectionPublished)->link)->toBe("/etats-des-lieux/{$edl}")
        ->and(N::premiere($this->w['manager'], Type::InspectionsRemarkReceived)->link)->toBe("/baux/{$this->bail->id}");

    foreach (Notification::query()->whereIn('type', ['tenant.inspection_remark_answered', 'inspections.remark_received'])->get() as $n) {
        expect($n->body)->not->toContain('accepted')->not->toContain($this->moi['party']->id);
    }
});

it('paiement en ligne échoué : le payeur seul est prévenu, sans montant', function (): void {
    OnlinePaymentFailed::dispatch(($this->id)(), $this->org->id, $this->bail->id, $this->moi['party']->id);

    $n = N::premiere($this->moi['user'], Type::TenantOnlinePaymentFailed);

    expect(N::nombre($this->comptaColoc))->toBe(0)
        ->and(N::nombre($this->w['owner']))->toBe(0)
        ->and($n->link)->toBe('/loyers/payer')
        ->and($n->body)->toContain('aucune somme n\'a été encaissée')->not->toMatch('/\d+\s?(€|EUR)/');
});

it('demande de modification de coordonnées : propriétaire, administrateur et gestionnaire, pas le comptable, sans nom', function (): void {
    ContactUpdateRequested::dispatch(($this->id)(), $this->moi['party']->id, $this->org->id);

    expect(N::types($this->w['owner']))->toBe(['parties.contact_update_requested'])
        ->and(N::types($this->w['manager']))->toBe(['parties.contact_update_requested'])
        ->and(N::nombre($this->w['accountant']))->toBe(0)
        ->and(N::nombre($this->moi['user']))->toBe(0)
        ->and(N::premiere($this->w['owner'], Type::PartiesContactUpdateRequested)->body)->not->toContain($this->moi['party']->id);
});

it('cloisonne par organisation : l\'équipe d\'une autre agence ne reçoit rien', function (): void {
    $autre = T::organisation('Immo Loire');
    $equipeAutre = N::equipe($autre);

    NoticeRequested::dispatch(($this->id)(), $this->bail->id, $this->org->id);
    InspectionRemarkReceived::dispatch(($this->id)(), ($this->id)(), $this->bail->id, $this->org->id, $this->moi['party']->id);
    ContactUpdateRequested::dispatch(($this->id)(), $this->moi['party']->id, $this->org->id);

    foreach ($equipeAutre as $compte) {
        expect(N::nombre($compte))->toBe(0);
    }
});

it('respecte les préférences : un locataire qui coupe l\'e-mail garde le centre, un type verrouillé reste dans le centre', function (): void {
    $compte = $this->moi['user'];
    NotificationPreference::query()->create(['user_id' => $compte->id, 'type' => Type::TenantNoticeClosed->value, 'channel' => 'in_app', 'enabled' => false]);
    NotificationPreference::query()->create(['user_id' => $compte->id, 'type' => Type::TenantNoticeClosed->value, 'channel' => 'email', 'enabled' => false]);
    NotificationPreference::query()->create(['user_id' => $compte->id, 'type' => Type::TenantDocumentShared->value, 'channel' => 'email', 'enabled' => false]);

    NoticeRequestClosed::dispatch(($this->id)(), $this->bail->id, $this->org->id, $this->moi['party']->id, NoticeRequestOutcome::Recorded);
    LeaseDocumentShared::dispatch(($this->id)(), $this->bail->id, $this->org->id, null);

    expect(N::premiere($compte, Type::TenantNoticeClosed)->in_app)->toBeTrue()
        ->and(N::premiere($compte, Type::TenantNoticeClosed)->email)->toBeFalse()
        ->and(N::premiere($compte, Type::TenantDocumentShared)->email)->toBeFalse()
        ->and(N::premiere($compte, Type::TenantDocumentShared)->in_app)->toBeTrue();
});
