<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Controllers\Owner;

use App\Modules\Identity\Enums\ErrorCode as IdentityError;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\PublicApi\TwoFactorProofs;
use App\Modules\Maintenance\Actions\DecideApproval;
use App\Modules\Maintenance\Data\OwnerDecisionData;
use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Http\Requests\OwnerApprovalDecisionRequest;
use App\Modules\Maintenance\Http\Resources\Owner\OwnerApprovalResource;
use App\Modules\Maintenance\Http\Support\IdempotencyHeader;
use App\Modules\Maintenance\Queries\OwnerInterventions;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Shared\Http\ConsoleRelay;
use App\Shared\Tenancy\CurrentOrganization;

final class DecideOwnerApprovalController
{
    public function __invoke(
        string $intervention,
        string $approval,
        OwnerApprovalDecisionRequest $request,
        MandateDirectory $mandats,
        OwnerInterventions $interventions,
        TwoFactorProofs $preuves,
        CurrentOrganization $contexte,
        DecideApproval $action,
    ): OwnerApprovalResource {
        /** @var User $user */
        $user = $request->user();
        $portee = $mandats->ownerScope($user->id);
        $cible = $interventions->find($portee, $intervention) ?? throw ErrorCode::OwnerInterventionNotFound->problem();
        $visible = $portee->visible($cible->organization_id, (string) $cible->mandant_party_id) ?? throw ErrorCode::OwnerInterventionNotFound->problem();
        $mandats->assertOwnerWritable($visible);

        $cle = IdempotencyHeader::read($request);
        $preuve = $preuves->recent($request) ?? throw IdentityError::ReauthenticationRequired->problem();

        $resultat = $contexte->run($cible->organization_id, fn (): array => $action->handle($cible->id, $approval, new OwnerDecisionData(
            $user->id,
            $visible->accessId,
            $request->decision(),
            $request->comment(),
            $request->lockVersion(),
            $request->quoteFingerprint(),
            $request->statementVersion(),
            $cle,
            $preuve,
            ConsoleRelay::ipClient($request),
            $request->userAgent(),
        )));

        return new OwnerApprovalResource($resultat);
    }
}
