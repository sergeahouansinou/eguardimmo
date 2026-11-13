<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Resources;

use App\Modules\Identity\Data\MobileLoginResult;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property MobileLoginResult $resource
 */
final class MobileLoginResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return $this->resource->challenge !== null
            ? ['two_factor' => true, 'challenge' => $this->resource->challenge]
            : ['two_factor' => false, 'token' => $this->resource->token];
    }
}
