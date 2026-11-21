<?php

declare(strict_types=1);

namespace App\Modules\Banking\Http\Controllers\Organization;

use App\Modules\Banking\Actions\UpdateBankRule;
use App\Modules\Banking\Http\Requests\UpdateRuleRequest;
use App\Modules\Banking\Http\Resources\BankRuleResource;

final class UpdateRuleController
{
    public function __invoke(UpdateRuleRequest $request, string $rule, UpdateBankRule $modification): BankRuleResource
    {
        return new BankRuleResource($modification->handle($rule, $request->toData(), (int) $request->validated('lock_version')));
    }
}
