import "@typespec/http";
import "./main.tsp";

using TypeSpec.Http;

@service(#{
  title: "Sanjaya Dynamic Reporting API",
})
namespace Rest.Api.V1;
